
import type { User, ChatMessage } from '../types';

// --- LIARA CONFIGURATION ---
const LIARA_BASE_URL = process.env.LIARA_BASE_URL;
const API_KEY = process.env.LIARA_API_KEY;
const MODEL_ID = 'google/gemini-2.5-flash';

// --- ERROR HANDLING ---
export const AI_INIT_ERROR = `خطای حیاتی: اطلاعات اتصال به API لیارا پیدا نشد! 🔑

این برنامه برای اتصال به سرویس هوش مصنوعی (از طریق لیارا) به کلید و آدرس API نیاز دارد.

**راه حل برای اجرای محلی (Local):**
شما **باید** یک فایل به نام \`.env\` در پوشه اصلی پروژه خود بسازید و اطلاعات زیر را در آن قرار دهید:

\`LIARA_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\`
\`LIARA_BASE_URL=https://ai.liara.ir/api/..../v1\`

**راه حل برای Netlify:**
1. وارد داشبورد سایت خود در Netlify شوید.
2. به بخش Site settings > Build & deploy > Environment بروید.
3. متغیرهای بالا را اضافه کنید.

آدرس پایه (Base URL) را از پنل لیارا خود کپی کنید. پس از اعمال تغییرات، برنامه را مجدداً Deploy کنید.`;


export const handleGeminiError = (error: unknown): string => {
    const err = error as Error;
    let errorMessage = err.message || 'یک خطای ناشناخته رخ داد.';

    if (errorMessage.includes('401')) {
        return `خطای احراز هویت (401): کلید API لیارا شما نامعتبر یا منقضی شده است. لطفاً کلید API صحیح را در تنظیمات Netlify (متغیر LIARA_API_KEY) وارد کنید.`;
    }
    if (errorMessage.includes('429')) {
        return `شما به محدودیت تعداد درخواست در سرویس لیارا رسیده‌اید (خطای 429). لطفاً چند لحظه صبر کرده و دوباره تلاش کنید یا پلن خود را در لیارا بررسی نمایید.`;
    }
    // Add more specific Liara/OpenAI error parsings here if needed
    return `خطا در ارتباط با سرویس هوش مصنوعی: ${errorMessage}`;
};


// --- CORE API CALLS ---

async function generateOpenAICompletion(messages: any[], options: { jsonMode?: boolean } = {}): Promise<string> {
    if (!API_KEY || !LIARA_BASE_URL) throw new Error(AI_INIT_ERROR);

    const body: any = { model: MODEL_ID, messages };
    if (options.jsonMode) {
        body.response_format = { type: "json_object" };
    }

    try {
        const response = await fetch(`${LIARA_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || JSON.stringify(data));
        }
        return data.choices[0].message.content;
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
}

async function generateOpenAICompletionStream(messages: any[], onChunk: (chunk: string) => void): Promise<void> {
    if (!API_KEY || !LIARA_BASE_URL) throw new Error(AI_INIT_ERROR);
    
    try {
        const response = await fetch(`${LIARA_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: messages,
                stream: true,
            })
        });

        if (!response.ok || !response.body) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6).trim();
                    if (data === '[DONE]') {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const textChunk = parsed.choices[0]?.delta?.content || '';
                        if (textChunk) {
                            onChunk(textChunk);
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', data);
                    }
                }
            }
        }
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
}

// --- SERVICE FUNCTIONS ---

export async function generateStoryScenarioStream(userAbout: string, goal: string, idea: string, yesterdayFeedback: string, onChunk: (chunk: string) => void, image?: { data: string; mime: string }): Promise<void> {
    let feedbackPrompt = '';
    if (yesterdayFeedback && yesterdayFeedback.trim()) {
        feedbackPrompt = `
        **بازخورد استوری دیروز (مهم):**
        "${yesterdayFeedback}"
        `;
    }
    const prompt = `
    برای یک کاربر با مشخصات زیر، یک سناریوی استوری اینستاگرام بنویس.
    
    **مشخصات کاربر (برای لحن‌شناسی):**
    ${userAbout}
    
    **هدف اصلی از استوری امروز:**
    ${goal}
    
    **ایده خام کاربر برای استوری امروز:**
    ${idea}
    ${image ? "\n**نکته:** کاربر یک تصویر نیز ضمیمه کرده است. سناریو باید بر اساس این تصویر و ایده بالا باشد." : ""}
    
    ${feedbackPrompt}
    
    **دستورالعمل‌ها:**
    1.  سناریو باید شامل چند استوری (اسلاید) پشت سر هم باشد.
    2.  برای هر استوری، با لحنی ساده، صمیمی و خلاصه توضیح بده که کاربر چه کاری انجام دهد (چه بگوید، چه تصویری نمایش دهد).
    3.  متنی که باید در استوری نوشته شود را هم ارائه بده.
    4.  سناریو باید خلاقانه، جذاب و متناسب با لحن کاربر (که در مشخصاتش آمده) باشد.
    5.  از اموجی‌های مرتبط و جذاب (مثلاً ✨، 🚀،💡) در هر مرحله استفاده کن تا متن بصری‌تر شود. از * برای بولد کردن استفاده نکن.
    6.  **مهم:** هر استوری را با \`---\` از استوری بعدی جدا کن تا کاربر بتواند به راحتی هر بخش را کپی کند.
    `;
    
    const userMessageContent: any[] = [{ type: 'text', text: prompt }];
    if (image) {
        userMessageContent.push({
            type: 'image_url',
            image_url: {
                url: `data:${image.mime};base64,${image.data}`
            }
        });
    }

    await generateOpenAICompletionStream([{ role: 'user', content: userMessageContent as any }], onChunk);
}


export async function generateCaption(userAbout: string, contentDescription: string, image?: { data: string; mime: string }): Promise<string> {
    const prompt = `
    You are an expert Instagram content strategist.
    Based on the user's profile and the provided content, write an engaging and creative caption for their Instagram post.

    **User Profile:**
    ${userAbout}

    **Content Description/Idea:**
    ${contentDescription}
    ${image ? "\n**Note:** An image has been provided. The caption should be directly related to this image." : ""}

    **Instructions:**
    1.  Write the caption in Persian.
    2.  The caption should be attractive, encourage interaction (likes, comments, shares), and match the user's tone.
    3.  Include relevant and popular hashtags.
    4.  Use emojis appropriately to make the caption visually appealing.
    5.  Format the caption for readability (e.g., use line breaks).
    `;

    const userMessageContent: any[] = [{ type: 'text', text: prompt }];
    if (image) {
        userMessageContent.push({
            type: 'image_url',
            image_url: {
                url: `data:${image.mime};base64,${image.data}`
            }
        });
    }
    
    return await generateOpenAICompletion([{ role: 'user', content: userMessageContent as any }]);
}

export async function generateChatResponseStream(user: User, history: ChatMessage[], newUserMessage: { text: string; image?: { data: string; mime: string } }, onChunk: (chunk: string) => void): Promise<void> {
    const systemInstruction = `You are "هوش مصنوعی آیتــــم", a friendly AI expert in Instagram content strategy. You are talking to ${user.preferred_name || user.full_name} جان. Here's some info about their work: "${user.about_info}". You must speak in a friendly, conversational, and intimate Persian tone. Be very helpful and encouraging.`;
    
    // History is no longer sent to the API to save tokens, but is maintained in the frontend.
    // The AI will respond based on the system instruction and the user's latest message.
    const messages = [
        { role: 'system', content: systemInstruction },
    ];
    
    const userMessageContent: any[] = [{ type: 'text', text: newUserMessage.text }];
    if (newUserMessage.image) {
        userMessageContent.push({
            type: 'image_url',
            image_url: {
                url: `data:${newUserMessage.image.mime};base64,${newUserMessage.image.data}`
            }
        });
    }
    messages.push({ role: 'user', content: userMessageContent as any });

    await generateOpenAICompletionStream(messages, onChunk);
}

export async function analyzeInstagramScreenshot(imageData: string, mimeType: string): Promise<{ instagramId: string, visualAnalysis: string }> {
    const prompt = `Analyze this Instagram profile screenshot. Identify the Instagram username/handle. Also, provide a brief analysis of the visual identity, branding, color palette, and overall aesthetic. Respond in Persian. Your entire response must be a single JSON object with two keys: "instagramId" (string, the username without '@') and "visualAnalysis" (string, the analysis in Persian).`;
    
    const messages = [{
        role: 'user',
        content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } }
        ]
    }];
    
    const responseText = await generateOpenAICompletion(messages, { jsonMode: true });
    return JSON.parse(responseText);
};

export async function generateCompetitorAnalysis(instagramId: string, userAbout: string): Promise<string> {
    const prompt = `Generate a friendly and colloquial competitor analysis for the Instagram account "@${instagramId}". 
    
    First, here is some information about the user you are helping: "${userAbout}". Start your analysis by comparing the competitor's page to the user's business based on this info.
    
    Then, analyze the competitor's:
    - Profile (ID, name, bio)
    - Highlights
    - Posts (visual theme, content types)
    
    Provide actionable insights based on what you see. Structure the response in Persian, using markdown for formatting with headings, lists, and plenty of emojis instead of asterisks for emphasis.`;

    return await generateOpenAICompletion([{ role: 'user', content: prompt }]);
};

export async function generateHooksOrCTAs(scenarioContent: string, type: 'hooks' | 'ctas'): Promise<string> {
    const prompt = `
    Based on the following Instagram video scenario, generate a list of 50 creative and engaging ${type === 'hooks' ? 'hooks (قلاب)' : 'calls to action (کال تو اکشن)'}.
    The list should be in Persian, numbered, and concise.

    **Scenario:**
    "${scenarioContent}"

    **Instructions:**
    - Generate exactly 50 items.
    - The tone should be suitable for Instagram.
    - Present them as a numbered list.
    `;
    return await generateOpenAICompletion([{ role: 'user', content: prompt }]);
}

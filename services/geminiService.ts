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
    if (errorMessage.toLowerCase().includes('json')) {
        return `خطا در پردازش پاسخ از هوش مصنوعی. ممکن است پاسخ دریافتی در قالب استاندارد (JSON) نباشد. لطفاً دوباره تلاش کنید.`
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
export interface StorySlide {
    title: string;
    instruction: string;
    storyText: string;
}

export async function generateStoryScenario(userAbout: string, goal: string, idea: string, yesterdayFeedback: string, image?: { data: string; mime: string }): Promise<{slides: StorySlide[]}> {
    let feedbackPrompt = '';
    if (yesterdayFeedback && yesterdayFeedback.trim()) {
        feedbackPrompt = `\n**بازخورد استوری دیروز (مهم):** "${yesterdayFeedback}"`;
    }
    const prompt = `
    برای یک کاربر با مشخصات زیر، یک سناریوی استوری اینستاگرام در قالب JSON بنویس.

    **مشخصات کاربر (برای لحن‌شناسی):**
    ${userAbout}
    
    **هدف اصلی از استوری امروز:**
    ${goal}
    
    **پیشنهاد کالا یا خدماتت برای استوری امروز:**
    ${idea}
    ${image ? "\n**نکته:** کاربر یک تصویر نیز ضمیمه کرده است. سناریو باید بر اساس این تصویر و ایده بالا باشد." : ""}
    ${feedbackPrompt}
    
    **دستورالعمل‌های خروجی (بسیار مهم):**
    1.  پاسخ تو باید یک آبجکت JSON معتبر باشد.
    2.  این آبجکت باید یک کلید به نام "slides" داشته باشد که مقدار آن یک آرایه از آبجکت‌های استوری است.
    3.  هر آبجکت استوری در آرایه باید شامل سه کلید باشد:
        - "title": (string) عنوان استوری (مثال: "استوری ۱: (تصویر/ویدئو)")
        - "instruction": (string) توضیحات اجرایی با لحنی صمیمی و ساده برای کاربر (مثال: "اول از محصولت یه ویدئوی جذاب بگیر...")
        - "storyText": (string) متنی که باید مستقیماً روی استوری نوشته شود.
    4.  از اموجی‌های مرتبط و جذاب (✨, 🚀, 💡) در متن‌ها استفاده کن.
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

    const responseText = await generateOpenAICompletion([{ role: 'user', content: userMessageContent as any }], { jsonMode: true });
    return JSON.parse(responseText);
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
    const systemInstruction = `You are "هوش مصنوعی آیتــــم", a friendly AI expert in Instagram content strategy. You are talking to ${user.preferred_name ? user.preferred_name + ' جان' : user.full_name}. Here's some info about their work: "${user.about_info}". You must speak in a friendly, conversational, and intimate Persian tone. Be very helpful and encouraging.`;
    
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
    const prompt = `
    یک تحلیل کوتاه و کاربردی برای پیج اینستاگرام "@${instagramId}" بنویس. 
    لحن باید صمیمی و محاوره‌ای باشد. فقط نکات کلیدی و تحلیلی را بگو و از توصیف موارد واضح (مثل رنگ لباس در عکس) پرهیز کن.

    **دستورالعمل‌های بسیار مهم:**
    1.  **حتما** در ابتدای تحلیل، یک فهرست میانبر (Table of Contents) با لینک‌های داخلی به هر بخش ایجاد کن. مثال:
        - [👤 پروفایل (آیدی، نام، بیو)](#profile)
        - [✨ هایلایت‌ها](#highlights)
        - [📱 پست‌ها](#posts)
    2.  برای هر بخش، از عنوان‌های مارک‌داون سطح 3 (###) به همراه یک اموجی مرتبط و یک id برای لینک داخلی استفاده کن. مثال: \`### 👤 پروفایل (آیدی، نام، بیو) {#profile}\`
    3.  تحلیل باید شامل بخش‌های زیر باشد: پروفایل، هایلایت‌ها، و پست‌ها.
    4.  به جای لیست‌های ستاره‌دار (*)، از اموجی‌های مرتبط برای لیست کردن موارد استفاده کن.
    5.  تحلیل باید مختصر، مفید و کاملاً کاربردی باشد و روی پیشنهادهای عملی تمرکز کند.
    `;
    return await generateOpenAICompletion([{ role: 'user', content: prompt }]);
};

export async function generateHooksOrCTAs(scenarioContent: string, type: 'hooks' | 'ctas'): Promise<string> {
    const prompt = `
    بر اساس سناریوی پست اینستاگرام زیر، یک لیست شامل 50 ${type === 'hooks' ? 'قلاب (Hook)' : 'دعوت به اقدام (Call to Action)'} خلاقانه و جذاب به زبان فارسی بنویس.

    **سناریو:**
    "${scenarioContent}"

    **دستورالعمل‌ها:**
    - دقیقاً 50 مورد تولید کن.
    - هر مورد باید کوتاه و تیتروار باشد.
    - لیست باید شماره‌گذاری شده باشد.
    `;
    return await generateOpenAICompletion([{ role: 'user', content: prompt }]);
}

export async function analyzePosts(imageData: string[], mimeType: string): Promise<string> {
    const prompt = "این اسکرین‌شات‌ها مربوط به پست‌های یک پیج اینستاگرام است. لطفاً موارد زیر را به صورت خلاصه و تحلیلی (نه توصیفی) بررسی کن: تم رنگی، موضوعات اصلی محتوا، کیفیت بصری و گرافیک، و ساختار کپشن‌ها. در پایان چند پیشنهاد برای بهبود ارائه بده. از لحن صمیمی و اموجی استفاده کن.";
    const userMessageContent: any[] = [{ type: 'text', text: prompt }];
    imageData.forEach(data => {
        userMessageContent.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${data}` }
        });
    });
    return await generateOpenAICompletion([{ role: 'user', content: userMessageContent as any }]);
}

export async function analyzeStories(imageData: string[], mimeType: string): Promise<string> {
    const prompt = "این اسکرین‌شات‌ها مربوط به استوری‌های یک پیج در 24 ساعت گذشته است. لطفاً استراتژی استوری این پیج را تحلیل کن. به مواردی مثل: نوع محتوا (آموزشی، سرگرمی، فروش)، نحوه ارتباط با مخاطب، استفاده از استیکرها، و توالی استوری‌ها توجه کن. در پایان چند پیشنهاد برای بهبود ارائه بده. از لحن صمیمی و اموجی استفاده کن.";
    const userMessageContent: any[] = [{ type: 'text', text: prompt }];
    imageData.forEach(data => {
        userMessageContent.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${data}` }
        });
    });
    return await generateOpenAICompletion([{ role: 'user', content: userMessageContent as any }]);
}

export async function compareProfiles(competitorImage: string, userImage: string, mimeType: string): Promise<string> {
    const prompt = `
    این دو تصویر، اسکرین‌شات از دو پیج اینستاگرام هستند. تصویر اول مربوط به رقیب و تصویر دوم مربوط به کاربر من است.
    لطفاً این دو پیج را در بخش‌های زیر مقایسه کن:
    - پروفایل (آیدی، نام، بیو)
    - هویت بصری (عکس پروفایل، تم رنگی پست‌ها)
    - هایلایت‌ها
    برای هر بخش، نقاط قوت و ضعف هر کدام را به طور خلاصه بگو و در نهایت چند پیشنهاد به کاربر من برای بهتر شدن بده. از لحن صمیمی و اموجی استفاده کن.`;
    
    const messages = [{
        role: 'user',
        content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${competitorImage}` } },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${userImage}` } }
        ]
    }];
    
    return await generateOpenAICompletion(messages);
}
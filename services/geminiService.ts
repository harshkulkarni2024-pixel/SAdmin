
// This service now uses the Liara AI API, assuming an OpenAI-compatible endpoint.
import type { User, ChatMessage } from '../types';

// --- LIARA AI CONFIGURATION ---
const LIARA_API_KEY = process.env.LIARA_API_KEY;
const LIARA_BASE_URL = process.env.LIARA_BASE_URL || 'https://api.liara.ir/v1';
const MODEL_NAME = 'llama3-8b'; // A reasonable default model from Liara

export const AI_INIT_ERROR = `خطای حیاتی: کلید API لیارا پیدا نشد! 🔑

این برنامه برای اتصال به سرویس هوش مصنوعی Liara به کلید API و آدرس پایه نیاز دارد.

**راه حل برای اجرای محلی (Local):**
شما **باید** یک فایل به نام \`.env\` در پوشه اصلی پروژه خود بسازید و کلید خود را در آن قرار دهید:

\`LIARA_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\`
\`LIARA_BASE_URL=https://api.liara.ir\`

**راه حل برای Netlify/Vercel/GitHub Pages:**
1. وارد داشبورد سرویس هاستینگ خود شوید.
2. به بخش تنظیمات Environment Variables (متغیرهای محیطی) بروید.
3. متغیرهای جدید با نام \`LIARA_API_KEY\` و \`LIARA_BASE_URL\` و مقادیر مربوطه را اضافه کنید.

پس از اعمال تغییرات، برنامه را مجدداً Deploy کنید.`;

if (!LIARA_API_KEY) {
    console.error(AI_INIT_ERROR);
}

export const handleAiError = (error: unknown): string => {
    const err = error as Error;
    console.error("Liara API Error:", err);

    if (err.message.includes('401')) {
        return `خطای احراز هویت: کلید API لیارا شما نامعتبر است. لطفاً کلید صحیح را در تنظیمات محیطی (فایل .env یا تنظیمات هاستینگ) وارد کنید.`;
    }
    if (err.message.includes('429')) {
        return `شما به محدودیت تعداد درخواست (quota) خود رسیده‌اید. لطفاً پلن خود را در Liara بررسی نمایید.`;
    }
    return `خطا در ارتباط با سرویس هوش مصنوعی: ${err.message}`;
};

// --- Generic Fetch Function ---
async function fetchLiara(body: object) {
    if (!LIARA_API_KEY) throw new Error(AI_INIT_ERROR);

    const response = await fetch(`${LIARA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${LIARA_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`[${response.status}] ${response.statusText}: ${errorBody}`);
    }

    return response;
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
    برای یک کاربر با مشخصات زیر، یک سناریوی استوری اینستاگرام بنویس.

    **مشخصات کاربر (برای لحن‌شناسی):**
    ${userAbout}
    
    **هدف اصلی از استوری امروز:**
    ${goal}
    
    **پیشنهاد کالا یا خدماتت برای استوری امروز:**
    ${idea}
    ${image ? "\n**نکته:** کاربر یک تصویر نیز ضمیمه کرده است. سناریو باید بر اساس این تصویر و ایده بالا باشد." : ""}
    ${feedbackPrompt}
    
    **دستورالعمل‌های خروجی (بسیار مهم):**
    1.  پاسخ تو باید یک آبجکت JSON معتبر باشد و هیچ متنی خارج از آن نباشد.
    2.  این آبجکت باید یک کلید به نام "slides" داشته باشد که مقدار آن یک آرایه از آبجکت‌های استوری است.
    3.  هر آبجکت استوری در آرایه باید شامل سه کلید باشد: "title", "instruction", "storyText".
    4.  از اموجی‌های مرتبط و جذاب (✨, 🚀, 💡) در متن‌ها استفاده کن.
    `;

    try {
        const response = await fetchLiara({
            model: MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.8,
        });
        const data = await response.json();
        const text = data.choices[0].message.content;
        if (!text) throw new Error("پاسخ متنی از سرویس هوش مصنوعی دریافت نشد.");
        return JSON.parse(text);
    } catch (e) {
        throw new Error(handleAiError(e));
    }
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

    const content: any[] = [{ type: 'text', text: prompt }];
    if (image) {
        content.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.data}` } });
    }
    
    try {
        const response = await fetchLiara({
            model: MODEL_NAME,
            messages: [{ role: 'user', content }],
        });
        const data = await response.json();
        return data.choices[0].message.content ?? '';
    } catch (e) {
        throw new Error(handleAiError(e));
    }
}

export async function generateChatResponseStream(user: User, history: ChatMessage[], newUserMessage: { text: string; image?: { data: string; mime: string } }, onChunk: (chunk: string) => void): Promise<void> {
    const systemInstruction = `You are "هوش مصنوعی آیتــــم", a friendly AI expert in Instagram content strategy. You are talking to ${user.preferred_name ? user.preferred_name + ' جان' : user.full_name}. Here's some info about their work: "${user.about_info || ''}". You must speak in a friendly, conversational, and intimate Persian tone.`;
    
    const userContent: any[] = [{ type: 'text', text: newUserMessage.text }];
    if (newUserMessage.image) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${newUserMessage.image.mime};base64,${newUserMessage.image.data}` } });
    }
    
    // Simplified history for context
    const messages = [
        { role: 'system', content: systemInstruction },
        ...history.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        })),
        { role: 'user', content: userContent }
    ];

    try {
        const response = await fetchLiara({
            model: MODEL_NAME,
            messages: messages,
            stream: true
        });

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get stream reader.");
        
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

            for (const line of lines) {
                const jsonStr = line.replace('data: ', '');
                if (jsonStr === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices[0]?.delta?.content;
                    if (content) {
                        onChunk(content);
                    }
                } catch (e) {
                    // Ignore parsing errors for incomplete JSON chunks
                }
            }
        }
    } catch (e) {
        throw new Error(handleAiError(e));
    }
}

export async function analyzeInstagramScreenshot(imageData: string, mimeType: string): Promise<{ instagramId: string, visualAnalysis: string }> {
    const prompt = `Analyze this Instagram profile screenshot. Identify the Instagram username/handle. Also, provide a brief analysis of the visual identity, branding, color palette, and overall aesthetic. Respond in Persian with a valid JSON object like this: {"instagramId": "the_username", "visualAnalysis": "Your analysis here"}.`;
    
    const content: any[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } }
    ];

    try {
        const response = await fetchLiara({
            model: MODEL_NAME,
            messages: [{ role: 'user', content }],
            response_format: { type: 'json_object' }
        });
        const data = await response.json();
        const text = data.choices[0].message.content;
        if (!text) throw new Error("پاسخ متنی از سرویس هوش مصنوعی دریافت نشد.");
        return JSON.parse(text);
    } catch(e) {
        throw new Error(handleAiError(e));
    }
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
    try {
        const response = await fetchLiara({ model: MODEL_NAME, messages: [{role: 'user', content: prompt }] });
        const data = await response.json();
        return data.choices[0].message.content ?? '';
    } catch(e) {
        throw new Error(handleAiError(e));
    }
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
    try {
        const response = await fetchLiara({ model: MODEL_NAME, messages: [{role: 'user', content: prompt }] });
        const data = await response.json();
        return data.choices[0].message.content ?? '';
    } catch(e) {
        throw new Error(handleAiError(e));
    }
}

// The following functions are not implemented as Liara may not support multiple images in a single prompt.
// A more advanced implementation would require multiple API calls.
export async function analyzePosts(imageData: string[], mimeType: string): Promise<string> {
    return Promise.resolve("تحلیل همزمان چند پست در این نسخه پشتیبانی نمی‌شود. لطفاً یک اسکرین شات از یک پست را در بخش چت آپلود و تحلیل آن را بخواهید.");
}

export async function analyzeStories(imageData: string[], mimeType: string): Promise<string> {
    return Promise.resolve("تحلیل همزمان چند استوری در این نسخه پشتیبانی نمی‌شود. لطفاً یک اسکرین شات از یک استوری را در بخش چت آپلود و تحلیل آن را بخواهید.");
}

export async function compareProfiles(competitorImage: string, userImage: string, mimeType: string): Promise<string> {
    return Promise.resolve("مقایسه پروفایل‌ها در این نسخه پشتیبانی نمی‌شود. لطفاً از بخش تحلیل رقبا برای هر پیج به صورت جداگانه استفاده کنید.");
}

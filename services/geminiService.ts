import { GoogleGenAI, Part, Type } from "@google/genai";
import type { User, ChatMessage } from '../types';

// --- GEMINI CONFIGURATION ---
const API_KEY = process.env.API_KEY;
// Fix: Define the model name constant to be used across the service.
const MODEL_NAME = 'gemini-2.5-flash';

export const AI_INIT_ERROR = `خطای حیاتی: کلید API گوگل پیدا نشد! 🔑

این برنامه برای اتصال به سرویس هوش مصنوعی Gemini به کلید API نیاز دارد.

**راه حل برای اجرای محلی (Local):**
شما **باید** یک فایل به نام \`.env\` در پوشه اصلی پروژه خود بسازید و کلید خود را در آن قرار دهید:

\`API_KEY=AIzaSy...xxxxxxxxxx\`

**راه حل برای Netlify/Vercel/GitHub Pages:**
1. وارد داشبورد سرویس هاستینگ خود شوید.
2. به بخش تنظیمات Environment Variables (متغیرهای محیطی) بروید.
3. یک متغیر جدید با نام \`API_KEY\` و مقدار کلید API خود اضافه کنید.

پس از اعمال تغییرات، برنامه را مجدداً Deploy کنید.`;

if (!API_KEY) {
    console.error(AI_INIT_ERROR);
}

// Conditionally initialize 'ai' to prevent runtime errors if the key is missing.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const handleGeminiError = (error: unknown): string => {
    const err = error as Error;
    console.error("Gemini API Error:", err);
    if (err.message.includes('API key not valid')) {
        return `خطای احراز هویت: کلید API شما نامعتبر است. لطفاً کلید صحیح را در تنظیمات محیطی (فایل .env یا تنظیمات هاستینگ) وارد کنید.`;
    }
    if (err.message.includes('quota')) {
        return `شما به محدودیت تعداد درخواست (quota) خود رسیده‌اید. لطفاً پلن خود را در Google AI Studio بررسی نمایید.`;
    }
    return `خطا در ارتباط با سرویس هوش مصنوعی: ${err.message}`;
};

// --- Helper Functions ---
const imageToPart = (data: string, mime: string): Part => ({
  inlineData: { data, mimeType: mime },
});

// --- SERVICE FUNCTIONS ---
export interface StorySlide {
    title: string;
    instruction: string;
    storyText: string;
}

export async function generateStoryScenario(userAbout: string, goal: string, idea: string, yesterdayFeedback: string, image?: { data: string; mime: string }): Promise<{slides: StorySlide[]}> {
    if (!ai) throw new Error(AI_INIT_ERROR);

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
    1.  پاسخ تو باید یک آبجکت JSON معتبر باشد.
    2.  این آبجکت باید یک کلید به نام "slides" داشته باشد که مقدار آن یک آرایه از آبجکت‌های استوری است.
    3.  هر آبجکت استوری در آرایه باید شامل سه کلید باشد: "title", "instruction", "storyText".
    4.  از اموجی‌های مرتبط و جذاب (✨, 🚀, 💡) در متن‌ها استفاده کن.
    `;
    
    const contentParts: Part[] = [{ text: prompt }];
    if (image) {
        contentParts.push(imageToPart(image.data, image.mime));
    }

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: contentParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        slides: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: 'عنوان استوری (مثال: "استوری ۱: (تصویر/ویدئو)")' },
                                    instruction: { type: Type.STRING, description: 'توضیحات اجرایی با لحنی صمیمی و ساده برای کاربر (مثال: "اول از محصولت یه ویدئوی جذاب بگیر...")' },
                                    storyText: { type: Type.STRING, description: 'متنی که باید مستقیماً روی استوری نوشته شود.' },
                                }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text);
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
}


export async function generateCaption(userAbout: string, contentDescription: string, image?: { data: string; mime: string }): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
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

    const contentParts: Part[] = [{ text: prompt }];
    if (image) {
        contentParts.push(imageToPart(image.data, image.mime));
    }
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: contentParts },
        });
        return response.text;
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
}

export async function generateChatResponseStream(user: User, history: ChatMessage[], newUserMessage: { text: string; image?: { data: string; mime: string } }, onChunk: (chunk: string) => void): Promise<void> {
    if (!ai) throw new Error(AI_INIT_ERROR);
    const systemInstruction = `You are "هوش مصنوعی آیتــــم", a friendly AI expert in Instagram content strategy. You are talking to ${user.preferred_name ? user.preferred_name + ' جان' : user.full_name}. Here's some info about their work: "${user.about_info || ''}". You must speak in a friendly, conversational, and intimate Persian tone. Be very helpful and encouraging.`;
    
    const userParts: Part[] = [{ text: newUserMessage.text }];
    if (newUserMessage.image) {
        userParts.push(imageToPart(newUserMessage.image.data, newUserMessage.image.mime));
    }

    try {
        const responseStream = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: { parts: userParts },
            config: {
                systemInstruction: systemInstruction,
            },
        });

        for await (const chunk of responseStream) {
            onChunk(chunk.text);
        }
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
}

export async function analyzeInstagramScreenshot(imageData: string, mimeType: string): Promise<{ instagramId: string, visualAnalysis: string }> {
    if (!ai) throw new Error(AI_INIT_ERROR);
    const prompt = `Analyze this Instagram profile screenshot. Identify the Instagram username/handle. Also, provide a brief analysis of the visual identity, branding, color palette, and overall aesthetic. Respond in Persian.`;
    
    const contentParts: Part[] = [{ text: prompt }, imageToPart(imageData, mimeType)];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: contentParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        instagramId: { type: Type.STRING, description: "The Instagram username without the '@' symbol." },
                        visualAnalysis: { type: Type.STRING, description: "The visual analysis in Persian." },
                    }
                }
            }
        });
        return JSON.parse(response.text);
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
};

export async function generateCompetitorAnalysis(instagramId: string, userAbout: string): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
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
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
        return response.text;
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
};

export async function generateHooksOrCTAs(scenarioContent: string, type: 'hooks' | 'ctas'): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
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
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
        return response.text;
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
}

export async function analyzePosts(imageData: string[], mimeType: string): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
    const prompt = "این اسکرین‌شات‌ها مربوط به پست‌های یک پیج اینستاگرام است. لطفاً موارد زیر را به صورت خلاصه و تحلیلی (نه توصیفی) بررسی کن: تم رنگی، موضوعات اصلی محتوا، کیفیت بصری و گرافیک، و ساختار کپشن‌ها. در پایان چند پیشنهاد برای بهبود ارائه بده. از لحن صمیمی و اموجی استفاده کن.";
    
    const contentParts: Part[] = [{ text: prompt }];
    imageData.forEach(data => contentParts.push(imageToPart(data, mimeType)));
    
    try {
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: contentParts } });
        return response.text;
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
}

export async function analyzeStories(imageData: string[], mimeType: string): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
    const prompt = "این اسکرین‌شات‌ها مربوط به استوری‌های یک پیج در 24 ساعت گذشته است. لطفاً استراتژی استوری این پیج را تحلیل کن. به مواردی مثل: نوع محتوا (آموزشی، سرگرمی، فروش)، نحوه ارتباط با مخاطب، استفاده از استیکرها، و توالی استوری‌ها توجه کن. در پایان چند پیشنهاد برای بهبود ارائه بده. از لحن صمیمی و اموجی استفاده کن.";
    
    const contentParts: Part[] = [{ text: prompt }];
    imageData.forEach(data => contentParts.push(imageToPart(data, mimeType)));

    try {
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: contentParts } });
        return response.text;
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
}

export async function compareProfiles(competitorImage: string, userImage: string, mimeType: string): Promise<string> {
    if (!ai) throw new Error(AI_INIT_ERROR);
    const prompt = `
    این دو تصویر، اسکرین‌شات از دو پیج اینستاگرام هستند. تصویر اول مربوط به رقیب و تصویر دوم مربوط به کاربر من است.
    لطفاً این دو پیج را در بخش‌های زیر مقایسه کن:
    - پروفایل (آیدی، نام، بیو)
    - هویت بصری (عکس پروفایل، تم رنگی پست‌ها)
    - هایلایت‌ها
    برای هر بخش، نقاط قوت و ضعف هر کدام را به طور خلاصه بگو و در نهایت چند پیشنهاد به کاربر من برای بهتر شدن بده. از لحن صمیمی و اموجی استفاده کن.`;
    
    const contentParts: Part[] = [
        { text: prompt },
        imageToPart(competitorImage, mimeType),
        imageToPart(userImage, mimeType)
    ];
    
    try {
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: contentParts } });
        return response.text;
    } catch(e) {
        throw new Error(handleGeminiError(e));
    }
}

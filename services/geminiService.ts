// FIX: Removed vite/client reference. Types for import.meta.env are now provided globally in types.ts.
import { GoogleGenAI, Modality, Chat } from "@google/genai";

let ai: GoogleGenAI | null = null;
let isInitialized = false;

// A more descriptive and user-friendly error message for when the AI client fails to initialize.
export const AI_INIT_ERROR = `خطای حیاتی: کلید API جمینای پیدا نشد! 🔑

این یک باگ در کد نیست، بلکه به این معنی است که برنامه نمی‌تواند به کلید API شما دسترسی پیدا کند. طبق قوانین امنیتی، من اجازه ندارم کلید را مستقیماً در کد قرار دهم یا از شما در صفحه وب بپرسم.

**راه حل برای اجرای محلی (Local):**
شما **باید** یک فایل به نام \`.env\` در پوشه اصلی پروژه خود (کنار فایل \`package.json\`) بسازید و کلید خود را به این شکل در آن قرار دهید:

\`VITE_API_KEY=AIza...\`

(به جای \`AIza...\` کلید واقعی خود را قرار دهید)

**راه حل برای Netlify:**
1. وارد داشبورد سایت خود در Netlify شوید.
2. به بخش Site settings > Build & deploy > Environment بروید.
3. متغیر زیر را اضافه کنید:
   - Key: \`VITE_API_KEY\`, Value: \`<your-real-gemini-key>\`

این فایل به گیت‌هاب ارسال **نمی‌شود** و کلید شما امن باقی می‌ماند. پس از ساخت این فایل یا تنظیم متغیر در Netlify، برنامه را مجدداً اجرا یا Deploy کنید.`;

export const handleGeminiError = (error: unknown): string => {
    const err = error as Error;
    let errorMessage = err.message || 'یک خطای ناشناخته رخ داد.';
    let parsedError: any = null;

    try {
        const jsonStart = errorMessage.indexOf('{');
        if (jsonStart !== -1) {
            const jsonString = errorMessage.substring(jsonStart);
            parsedError = JSON.parse(jsonString);
            if (parsedError.error) parsedError = parsedError.error;
        }
    } catch (e) {
        // Not a valid JSON string, proceed with the original message
    }

    const effectiveMessage = parsedError?.message || errorMessage;

    if (effectiveMessage.includes('429') || /quota/i.test(effectiveMessage)) {
        return `متاسفانه، شما به محدودیت استفاده از سرویس هوش مصنوعی رسیده‌اید (Quota Exceeded).
        
این یک خطای فنی در برنامه نیست، بلکه به این معنی است که محدودیت‌های پلن رایگان شما در Google AI به پایان رسیده است. لطفاً برای اطلاعات بیشتر صورتحساب و پلن خود را در وب‌سایت Google AI بررسی کنید.`;
    }

    if (/billed users/i.test(effectiveMessage)) {
        return `خطای دسترسی به سرویس تولید عکس: 💳

سرویس تولید عکس (Imagen API) تنها برای کاربرانی فعال است که حساب پرداخت (Billing) خود را در Google Cloud فعال کرده باشند.

**راه حل:**
1. وارد Google Cloud Console شوید.
2. پروژه‌ای که کلید API شما به آن تعلق دارد را انتخاب کنید.
3. از منوی اصلی به بخش **Billing** بروید.
4. اگر حساب پرداخت ندارید، یک حساب جدید ایجاد کرده و آن را به پروژه خود متصل کنید.

این یک محدودیت از طرف گوگل است و به معنی وجود باگ در برنامه نیست. پس از فعال‌سازی پرداخت، این قابلیت برای شما فعال خواهد شد.`;
    }

    const isPermissionDenied = parsedError?.status === 'PERMISSION_DENIED' || errorMessage.includes('PERMISSION_DENIED');
    const isReferrerBlocked = parsedError?.details?.[0]?.reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || /http referrer|referer blocked/i.test(errorMessage);

    if (isPermissionDenied && isReferrerBlocked) {
        const httpReferrer = parsedError?.details?.[0]?.metadata?.httpReferrer;
        const domain = httpReferrer ? new URL(httpReferrer).hostname : 'دامنه شما';
        
        return `خطای دسترسی (PERMISSION_DENIED): ⛔️
دامنه \`${domain}\` اجازه استفاده از این کلید API را ندارد.

**راه حل:**
شما باید این دامنه را به لیست دامنه‌های مجاز برای کلید API خود اضافه کنید:
1. وارد Google Cloud Console شوید.
2. به بخش "APIs & Services" > "Credentials" بروید.
3. کلید API مربوط به این پروژه را پیدا کرده و روی آن کلیک کنید تا وارد صفحه ویرایش شوید.
4. در بخش "Application restrictions"، گزینه "Websites" را انتخاب کنید.
5. روی "ADD" کلیک کرده و آدرس وب‌سایت خود را به این شکل وارد کنید: \`${window.location.origin}\`
6. **نکته مهم:** اگر از سرویس‌هایی مثل Netlify استفاده می‌کنید، باید آدرس‌های پیش‌نمایش (deploy preview) را هم اضافه کنید. برای راحتی کار می‌توانید از wildcard استفاده کنید (مثلاً: \`*.superadminitem.netlify.app/*\`).
7. تغییرات را ذخیره کنید. ممکن است چند دقیقه طول بکشد تا تنظیمات جدید اعمال شوند.`;
    }

    return effectiveMessage;
};


const getAiClient = (): GoogleGenAI => {
    // Return the existing instance if it's already created
    if (ai) {
        return ai;
    }
    
    // Throw a clear, user-facing error if the API key is missing.
    const apiKey = import.meta.env?.VITE_API_KEY;
    if (!apiKey) {
        console.error("Fatal Error: VITE_API_KEY is not defined in the environment.");
        throw new Error(AI_INIT_ERROR);
    }

    try {
        // Initialize the GoogleGenAI client
        ai = new GoogleGenAI({ apiKey });
        isInitialized = true;
        return ai;
    } catch(e) {
        console.error("Fatal Error: Could not initialize GoogleGenAI.", e);
        // Also throw the user-friendly error here.
        throw new Error(`خطا در راه‌اندازی سرویس هوش مصنوعی: ${(e as Error).message}`);
    }
}

export async function* generateStoryScenarioStream(userAbout: string, idea: string, yesterdayFeedback: string): AsyncGenerator<string> {
  try {
    const client = getAiClient();
    
    let feedbackPrompt = '';
    if (yesterdayFeedback && yesterdayFeedback.trim()) {
        feedbackPrompt = `
        نکته مهم: این بازخورد کاربر درمورد استوری دیروز است که باید در تحلیل و سناریوی امروزت لحاظ کنی:
        "${yesterdayFeedback}"
        `;
    }

    const prompt = `
    برای یک کاربر با مشخصات زیر، یک سناریوی استوری اینستاگرام بنویس.
    مشخصات کاربر: ${userAbout}
    ${feedbackPrompt}
    ایده خام کاربر برای استوری امروز: ${idea}
    
    سناریو باید شامل چند استوری پشت سر هم باشد و در هر استوری دقیقاً توضیح داده شود که کاربر چه کاری انجام دهد.
    سناریو باید خلاقانه، جذاب و با فرمت‌بندی زیبا باشد. از اموجی‌های مرتبط در هر مرحله استفاده کن و کلمات مهم را با تگ <b> پررنگ کن. از # و * استفاده نکن.
    `;
    
    const response = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    
    for await (const chunk of response) {
        yield chunk.text;
    }

  } catch (error) {
    console.error("Gemini story scenario stream error:", error);
    yield handleGeminiError(error);
  }
}

export async function* generateCaptionStream(userAbout: string, scenarioContent: string): AsyncGenerator<string> {
    try {
        const client = getAiClient();
        const prompt = `
        You are an expert Instagram content strategist.
        Based on the user's profile and the video scenario they just recorded, write an engaging and creative caption for their Instagram post.

        **User Profile:**
        ${userAbout}

        **Video Scenario:**
        ${scenarioContent}

        **Instructions:**
        1.  Write the caption in Persian.
        2.  The caption should be attractive, encourage interaction (likes, comments, shares), and match the user's tone.
        3.  Include relevant and popular hashtags.
        4.  Use emojis appropriately to make the caption visually appealing.
        5.  Format the caption for readability (e.g., use line breaks).
        `;
        
        const response = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        
        for await (const chunk of response) {
            yield chunk.text;
        }

    } catch (error) {
        console.error("Gemini caption stream error:", error);
        yield handleGeminiError(error);
    }
}

export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16', style: string): Promise<string> => {
    try {
        const client = getAiClient();
        const fullPrompt = style ? `${prompt}, in the style of ${style}` : prompt;

        const response = await client.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error('No image was generated by the API.');
        }

    } catch (error) {
        console.error("Gemini image generation error:", error);
        throw new Error(handleGeminiError(error));
    }
};

export const editImage = async (prompt: string, base64ImageData: string, mimeType: string): Promise<string> => {
    try {
        const client = getAiClient();

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const imageMimeType = part.inlineData.mimeType;
                return `data:${imageMimeType};base64,${base64ImageBytes}`;
            }
        }
        
        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                 throw new Error(`API Error: ${part.text}`);
            }
        }

        throw new Error('No image was returned from the edit operation.');

    } catch (error) {
        console.error("Gemini image edit error:", error);
        throw new Error(handleGeminiError(error));
    }
};

export const startChatSession = (userAbout: string, history: {role: 'user' | 'model', parts: {text: string}[]}[]): Chat => {
    const client = getAiClient();
    const systemInstruction = `
        You are a super-admin AI assistant for an Instagram content creator.
        Your name is "Super Admin Item". You are an expert in content strategy, engagement, and Instagram algorithms.
        You must communicate in Persian.

        **Formatting Rules:**
        - **CRITICAL:** Use double line breaks (a blank line) between paragraphs and list items to ensure readability. Your responses MUST NOT be a single block of text.
        - Use emojis to structure your lists and highlight points instead of asterisks (*). For example:
          - For lists, use emojis like 💡, ✅, 🔹, or similar.
        - For emphasis, you can use bold text by surrounding words with <b> and </b> tags.

        Here is some information about the user you are assisting:
        ---
        ${userAbout}
        ---
        Your role is to provide creative ideas, strategic advice, and answer questions to help them grow their Instagram presence. Be supportive, insightful, and professional.
    `;
    
    const chat = client.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: {
            systemInstruction: systemInstruction,
        },
    });

    return chat;
};

export const getLatestAlgorithmNews = async (): Promise<{text: string, groundingChunks: any[]}> => {
    try {
        const client = getAiClient();
        const prompt = "Provide a detailed summary of the latest updates and news about the Instagram algorithm for content creators. Focus on recent changes affecting reach, engagement, and content formats like Reels, Stories, and posts. Format the output using markdown for headings, bold text, and lists. The entire response must be in Persian.";

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        });

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        return { text, groundingChunks };

    } catch (error) {
        console.error("Gemini algorithm news error:", error);
        throw new Error(handleGeminiError(error));
    }
};
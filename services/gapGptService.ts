
const GAPGPT_API_KEY = process.env.GAPGPT_API_KEY;
const GAPGPT_BASE_URL = process.env.GAPGPT_BASE_URL || 'https://api.gapgpt.ir/v1'; // Default backup if not set

export const GAPGPT_INIT_ERROR = `خطای حیاتی: کلید API برای سرویس GapGPT پیدا نشد! 🔑

این بخش برای کارکرد صحیح نیاز به تنظیم کلید API در فایل .env یا تنظیمات هاست دارد.`;

interface GapGptResponse {
    choices: Array<{
        message: {
            content: string;
        }
    }>
}

export const generateStoryImageContent = async (userText: string, imageBase64: string, imageMime: string): Promise<string> => {
    if (!GAPGPT_API_KEY) {
        throw new Error(GAPGPT_INIT_ERROR);
    }

    const prompt = `
    وظیفه تو این است که به عنوان یک متخصص تولید محتوای اینستاگرام عمل کنی.
    کاربر یک عکس و یک متن ارسال کرده است.
    بر اساس این عکس و متن، یک استوری اینستاگرام جذاب، خلاقانه و حرفه‌ای طراحی کن.
    
    خروجی تو باید شامل موارد زیر باشد:
    1. متن اصلی استوری (کوتاه و جذاب).
    2. پیشنهاد برای استیکر یا گیف مناسب.
    3. پیشنهاد برای رنگ‌بندی پس‌زمینه یا فونت.
    4. اگر نیاز به موسیقی است، یک سبک موسیقی پیشنهاد بده.
    
    متن کاربر: "${userText}"
    `;

    const messages = [
        {
            role: "user",
            content: [
                { type: "text", text: prompt },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${imageMime};base64,${imageBase64}`
                    }
                }
            ]
        }
    ];

    try {
        const response = await fetch(`${GAPGPT_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GAPGPT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gemini-3-pro-image-preview",
                messages: messages,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`خطای سرویس (${response.status}): ${errorText}`);
        }

        const data: GapGptResponse = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("GapGPT Service Error:", error);
        throw error;
    }
};

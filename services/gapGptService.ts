
const GAPGPT_API_KEY = process.env.GAPGPT_API_KEY;
const GAPGPT_BASE_URL = process.env.GAPGPT_BASE_URL || 'https://api.gapgpt.ir/v1';

export const GAPGPT_INIT_ERROR = `خطای حیاتی: کلید API برای سرویس GapGPT پیدا نشد! 🔑

این بخش برای کارکرد صحیح نیاز به تنظیم کلید API در فایل .env یا تنظیمات هاست دارد.`;

interface ChatResponse {
    choices: Array<{
        message: {
            content: string;
        }
    }>
}

// Helper for standard fetches
async function fetchGapGpt(endpoint: string, body: any) {
    if (!GAPGPT_API_KEY) throw new Error(GAPGPT_INIT_ERROR);

    try {
        const response = await fetch(`${GAPGPT_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GAPGPT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `خطای سمت سرور (${response.status})`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage += `: ${errorJson.error.message}`;
                }
            } catch (e) { /* ignore parse error */ }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error("GapGPT Network Error:", error);
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new Error(`خطای ارتباط با سرور (Failed to fetch).
            
1. لطفاً VPN خود را بررسی کنید (برخی سرورهای ایرانی با VPN مشکل دارند).
2. مشکل CORS: مرورگر اجازه درخواست مستقیم به ${GAPGPT_BASE_URL} را نمی‌دهد.
3. آدرس API اشتباه است.`);
        }
        throw error;
    }
}

// Main Function: Single Step using Gemini 3 Pro
export const generateStoryImageContent = async (userText: string, imageBase64: string, imageMime: string): Promise<string> => {
    console.log("Requesting Image Generation from Gemini 3 Pro...");

    // We send the image + text to the Chat endpoint, but explicitly ask for IMAGE GENERATION.
    const messages = [
        {
            role: "user",
            content: [
                { 
                    type: "text", 
                    text: `GENERATE an image based on this input.
                    
                    User Request: "${userText}"
                    
                    The output MUST be an image URL. Create a high-quality, professional Instagram Story background that incorporates the style of the attached image and the theme of the text.` 
                },
                {
                    type: "image_url",
                    image_url: { url: `data:${imageMime};base64,${imageBase64}` }
                }
            ]
        }
    ];

    const data: ChatResponse = await fetchGapGpt('/chat/completions', {
        model: "gemini-3-pro-image-preview",
        messages: messages,
        temperature: 0.7 
    });

    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
        throw new Error("پاسخ نامعتبر از سرویس هوش مصنوعی.");
    }

    // Gemini via GapGPT usually returns the URL in markdown format like ![Image](https://...) or just the URL.
    // Regex to extract URL
    const urlMatch = content.match(/https?:\/\/[^\s)"]+/);
    
    if (urlMatch) {
        console.log("Image URL found:", urlMatch[0]);
        return urlMatch[0];
    }

    // If no URL found, log the text response for debugging
    console.warn("Model returned text instead of URL:", content);
    throw new Error("مدل به جای لینک تصویر، توضیحات متنی ارسال کرد. لطفاً دوباره تلاش کنید.");
};

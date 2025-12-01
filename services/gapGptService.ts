
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

interface ImageResponse {
    created: number;
    data: Array<{
        url: string;
        revised_prompt?: string;
    }>;
    error?: {
        message: string;
        type: string;
        code: string;
    }
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

// Step 1: Generate a prompt using Gemini Vision
async function generateImagePrompt(userText: string, imageBase64: string, imageMime: string): Promise<string> {
    const prompt = `
    You are an expert Instagram Story Designer and Prompt Engineer.
    The user has provided an image and a text request.
    
    User Text: "${userText}"
    
    YOUR TASK:
    Analyze the user's image and text. Then, write a detailed English prompt for an AI image generator (specifically Gemini 3 Pro Image) to create an Instagram Story background/image.
    
    The prompt should describe:
    - The subject (based on user image/text)
    - The style (Modern, Minimalist, Vibrant, etc.)
    - Composition (9:16 aspect ratio suitable for Stories)
    - Lighting and Color Palette
    
    Output ONLY the English prompt string. Do not add any conversational text.
    `;

    const messages = [
        {
            role: "user",
            content: [
                { type: "text", text: prompt },
                {
                    type: "image_url",
                    image_url: { url: `data:${imageMime};base64,${imageBase64}` }
                }
            ]
        }
    ];

    const data: ChatResponse = await fetchGapGpt('/chat/completions', {
        model: "gemini-3-pro-image-preview", // Used for vision analysis
        messages: messages,
        max_tokens: 500
    });

    if (!data.choices?.[0]?.message?.content) {
        throw new Error("تولید پرامپت تصویر با مشکل مواجه شد.");
    }

    return data.choices[0].message.content.trim();
}

// Main Function
export const generateStoryImageContent = async (userText: string, imageBase64: string, imageMime: string): Promise<string> => {
    // 1. Generate Prompt
    console.log("Generating prompt...");
    const imagePrompt = await generateImagePrompt(userText, imageBase64, imageMime);
    console.log("Prompt generated:", imagePrompt);

    // 2. Generate Image using Gemini 3 Pro Image
    console.log("Generating image with Gemini 3 Pro...");
    
    const imageResponse: ImageResponse = await fetchGapGpt('/images/generations', {
        model: "gemini-3-pro-image-preview",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1792", // Vertical for stories (if supported, else 1024x1024)
        response_format: "url"
    }).catch(async (err) => {
        // Fallback for size error
        if (err.message.includes('size')) {
            console.warn("Retrying with square size...");
            return await fetchGapGpt('/images/generations', {
                model: "gemini-3-pro-image-preview",
                prompt: imagePrompt,
                n: 1,
                size: "1024x1024"
            });
        }
        throw err;
    });

    if (!imageResponse.data?.[0]?.url) {
        throw new Error("تصویر تولید شد اما لینکی دریافت نشد.");
    }

    return imageResponse.data[0].url;
};

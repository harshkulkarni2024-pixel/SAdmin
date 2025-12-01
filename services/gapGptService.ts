
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

// Step 1: Generate a prompt using Gemini Vision
async function generateImagePrompt(userText: string, imageBase64: string, imageMime: string): Promise<string> {
    const prompt = `
    Analyze the user's image and text.
    User Text: "${userText}"
    
    Create a highly detailed English prompt for an AI image generator to create a stunning Instagram Story background.
    The prompt should specify: Subject, Style (Modern/Minimalist), Colors, Lighting.
    Output ONLY the prompt string.
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
        model: "gemini-3-pro-image-preview",
        messages: messages,
        max_tokens: 300
    });

    return data.choices[0]?.message?.content?.trim() || userText;
}

// Main Function
export const generateStoryImageContent = async (userText: string, imageBase64: string, imageMime: string): Promise<string> => {
    // 1. Generate Prompt
    console.log("Generating prompt...");
    const imagePrompt = await generateImagePrompt(userText, imageBase64, imageMime);
    console.log("Prompt generated:", imagePrompt);

    // 2. Generate Image using Chat Endpoint (Instruction following)
    // Some providers map image generation models to chat endpoints where you ask for the image.
    console.log("Generating image with Gemini 3 Pro (via Chat)...");
    
    const messages = [
        {
            role: "user",
            content: `Generate an image based on this description: ${imagePrompt}.
            
            IMPORTANT: Return ONLY the direct URL of the generated image. Do not include any explanation or markdown.`
        }
    ];

    const data: ChatResponse = await fetchGapGpt('/chat/completions', {
        model: "gemini-3-pro-image-preview",
        messages: messages
    });

    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
        throw new Error("پاسخ نامعتبر از سرویس هوش مصنوعی.");
    }

    // Try to extract URL if the model was chatty
    const urlMatch = content.match(/https?:\/\/[^\s)"]+/);
    if (urlMatch) {
        return urlMatch[0];
    }

    // If no URL found, it might be an error message or description
    if (!content.startsWith('http')) {
        console.warn("Model returned text instead of URL:", content);
        throw new Error("مدل به جای تصویر، متن بازگرداند. لطفاً دوباره تلاش کنید.");
    }

    return content;
};

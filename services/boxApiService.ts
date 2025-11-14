import type { BoxApiProfile } from '../types';

const BOX_API_KEY = process.env.BOX_API_KEY;
const BOX_API_URL = 'https://boxapi.ir/v1/instagram/profile';

export const BOX_API_INIT_ERROR = `خطای حیاتی: کلید API برای BoxAPI پیدا نشد! 🔑

این برنامه برای اتصال به سرویس اینستاگرام BoxAPI به کلید API نیاز دارد.

**راه حل:**
1.  وارد سایت boxapi.ir شوید و کلید API خود را از پنل کاربری کپی کنید.
2.  یک فایل به نام \`.env\` در پوشه اصلی پروژه خود بسازید (اگر وجود ندارد).
3.  کلید خود را به این شکل در فایل قرار دهید:

    \`BOX_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\`

پس از اعمال تغییرات، برنامه را مجدداً اجرا یا Deploy کنید.`;


export const getInstagramProfile = async (username: string): Promise<BoxApiProfile | null> => {
    if (!BOX_API_KEY) {
        throw new Error(BOX_API_INIT_ERROR);
    }

    try {
        const response = await fetch(BOX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${BOX_API_KEY}`
            },
            body: JSON.stringify({
                'username': username
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('BoxAPI Error:', errorData);
            throw new Error(errorData.message || `خطای ${response.status} از سرویس BoxAPI`);
        }
        
        const data = await response.json();

        if (data.status.toLowerCase() !== 'ok') {
            throw new Error(data.message || 'پاسخ ناموفق از BoxAPI');
        }

        return data.result as BoxApiProfile;

    } catch (error) {
        console.error("Failed to fetch from BoxAPI:", error);
        // Re-throw with a more user-friendly message if possible
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error("خطای شبکه در ارتباط با سرویس BoxAPI. لطفاً اتصال اینترنت خود را بررسی کنید.");
        }
        throw error; // Re-throw the original or modified error
    }
};

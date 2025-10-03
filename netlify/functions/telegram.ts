import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// --- مقادیر مهم که باید در تنظیمات Netlify قرار گیرند ---
// این مقادیر را برای امنیت نباید مستقیم در کد قرار داد.
const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-site.netlify.app/'; // آدرس اپلیکیشن شما

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_API_TOKEN}`;

// این تابع برای ارسال پیام به تلگرام استفاده می‌شود
async function sendMessage(chat_id: number, text: string, reply_markup: any) {
  const url = `${TELEGRAM_API_URL}/sendMessage`;
  const payload = {
    chat_id,
    text,
    reply_markup,
    parse_mode: "Markdown",
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!TELEGRAM_API_TOKEN) {
    console.error("TELEGRAM_API_TOKEN is not set in environment variables.");
    return { statusCode: 500, body: 'Server configuration error.' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const message = body.message || body.channel_post;

    if (message && message.text && message.text.startsWith('/app')) {
      const chat_id = message.chat.id;

      const responseText = `
🚀 **به سوپر ادمین آیتم خوش آمدید!**

برای ورود به پنل کاربری و استفاده از ابزارهای هوش مصنوعی، روی دکمه زیر کلیک کنید.
      `;

      const inline_keyboard = {
        inline_keyboard: [
          [
            {
              text: 'ورود به اپلیکیشن',
              url: WEB_APP_URL,
            },
          ],
        ],
      };

      await sendMessage(chat_id, responseText, inline_keyboard);
    }
  } catch (error) {
    console.error('Error processing Telegram update:', error);
  }

  // همیشه به تلگرام پاسخ 200 بدهید تا دوباره درخواست را نفرستد
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'OK' }),
  };
};

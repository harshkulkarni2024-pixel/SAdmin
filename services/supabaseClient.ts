import { createClient } from '@supabase/supabase-js';

// Supabase credentials loaded from environment variables.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// A detailed, user-friendly error message for when Supabase credentials are not configured.
export const SUPABASE_INIT_ERROR = `خطای حیاتی: اطلاعات اتصال به پایگاه داده پیدا نشد! 🗃️

برنامه نمی‌تواند به متغیرهای SUPABASE_URL و SUPABASE_ANON_KEY دسترسی پیدا کند. این متغیرها برای اتصال به پایگاه داده شما ضروری هستند.

**راه حل برای اجرای محلی (Local):**
یک فایل به نام \`.env\` در ریشه (پوشه اصلی) پروژه خود بسازید و اطلاعات پروژه Supabase خود را به این شکل در آن قرار دهید:

\`SUPABASE_URL=https://<your-project-ref>.supabase.co\`
\`SUPABASE_ANON_KEY=<your-anon-key>\`

**راه حل برای Netlify:**
1. وارد داشبورد سایت خود در Netlify شوید.
2. به بخش Site settings > Build & deploy > Environment بروید.
3. متغیرهای زیر را با مقادیر واقعی پروژه Supabase خود اضافه کنید:
   - Key: \`SUPABASE_URL\`, Value: \`https://<your-project-ref>.supabase.co\`
   - Key: \`SUPABASE_ANON_KEY\`, Value: \`<your-anon-key>\`

**چطور این اطلاعات را پیدا کنم؟**
1. وارد داشبورد پروژه خود در Supabase شوید.
2. روی آیکن چرخ‌دنده (Project Settings) در پایین منوی سمت چپ کلیک کنید.
3. بخش API را انتخاب کنید.
4. مقادیر Project URL و anon public key را از این صفحه کپی کرده و در فایل \`.env\` یا تنظیمات Netlify جای‌گذاری کنید.
`;


// Conditionally create the client. If env vars are missing, this will be null.
// Service files that use `supabase` are responsible for checking for null
// and throwing the SUPABASE_INIT_ERROR.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
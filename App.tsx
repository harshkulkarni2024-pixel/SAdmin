
import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { verifyAccessCode, isUserAdmin, getUserById } from './services/dbService';
import WelcomeScreen from './components/auth/WelcomeScreen';
import AdminView from './components/admin/AdminView';
import UserView from './components/user/UserView';
import { Loader } from './components/common/Loader';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const handleSupabaseError = (err: unknown): string => {
    const error = err as Error;
    console.error("Supabase operation failed:", error);

    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
        return `خطای شبکه: اتصال به پایگاه داده برقرار نشد. 🌐

این مشکل معمولاً به دلیل تنظیمات CORS در Supabase رخ می‌دهد. لطفاً مراحل زیر را دنبال کنید:
1. وارد داشبورد پروژه خود در Supabase شوید.
2. به بخش Authentication > URL Configuration بروید.
3. در قسمت Site URL، آدرس دقیق این برنامه را اضافه کنید.
   (برای تست محلی، معمولاً \`http://localhost:5173\` یا مشابه آن است)
4. تغییرات را ذخیره کرده و چند دقیقه صبر کنید.`;
    }
    
    if (error.message.includes('relation "public.users" does not exist')) {
        return `خطای پیکربندی پایگاه داده: جدول \`users\` پیدا نشد.

لطفاً مطمئن شوید که:
1. اسکریپت SQL برای ساخت جداول را در Supabase SQL Editor اجرا کرده‌اید.
2. جدول \`users\` در اسکیمای \`public\` وجود دارد.`;
    }

    if (error.message.includes('violates row-level security policy')) {
        return `خطای دسترسی پایگاه داده: قوانین امنیتی (RLS) مانع دسترسی به اطلاعات کاربر می‌شود.

لطفاً مطمئن شوید که:
1. Row Level Security برای جدول \`users\` فعال است.
2. یک پالیسی (Policy) برای SELECT ایجاد کرده‌اید که به کاربران احراز هویت شده (authenticated) اجازه خواندن اطلاعات خودشان را می‌دهد.`;
    }
    
    return `یک خطای ناشناخته در پایگاه داده رخ داد: ${error.message}`;
  };


  useEffect(() => {
    // The environment variable check has been removed.
    // The service files (supabaseClient.ts, geminiService.ts) now have hardcoded fallbacks,
    // so the app will work immediately without needing a .env file.
    
    const checkSession = async () => {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        const userId = parseInt(storedUserId, 10);
        if (!isNaN(userId)) {
          try {
            const user = await verifyAccessCode(String(userId), true);
            if (user) {
              setCurrentUser(user);
              setIsAdmin(isUserAdmin(user.user_id));
            } else {
              localStorage.removeItem('userId');
            }
          } catch (e) {
            setError(handleSupabaseError(e));
            localStorage.removeItem('userId');
          }
        } else {
          localStorage.removeItem('userId');
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = useCallback(async (code: string): Promise<boolean> => {
    setError('');
    setIsLoading(true);
    try {
      const user = await verifyAccessCode(code);
      if (user) {
        setCurrentUser(user);
        const adminStatus = isUserAdmin(user.user_id);
        setIsAdmin(adminStatus);
        localStorage.setItem('userId', String(user.user_id));
        return true;
      } else {
        setError('کد دسترسی یا رمز عبور نامعتبر است. لطفاً دوباره تلاش کنید.');
        return false;
      }
    } catch (err) {
        setError(handleSupabaseError(err));
        return false;
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('userId');
    // Clear the URL hash to prevent automatic navigation on re-login
    history.pushState(null, '', window.location.pathname);
  }, []);
  
  const handleUserUpdate = useCallback(async () => {
    if (!currentUser) return;
    const updatedUser = await getUserById(currentUser.user_id);
    setCurrentUser(updatedUser);
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader />
      </div>
    );
  }

  if (!currentUser) {
    return <WelcomeScreen onLogin={handleLogin} error={error} setError={setError} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {isAdmin ? (
        <AdminView user={currentUser} onLogout={handleLogout} />
      ) : (
        <UserView user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from './types';
import { verifyAccessCode, isUserAdmin, getUserById } from './services/dbService';
import WelcomeScreen from './components/auth/WelcomeScreen';
import AdminView from './components/admin/AdminView';
import UserView from './components/user/UserView';
import { Loader } from './components/common/Loader';
import { Icon } from './components/common/Icon';
import { UserProvider } from './contexts/UserContext';
import { NotificationProvider } from './contexts/NotificationContext';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [showExpiredSubscriptionMessage, setShowExpiredSubscriptionMessage] = useState(false);


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
    const initializeApp = async () => {
      // 1. Check IP Location
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          if (data.country_code === 'IR') {
            setIsBlocked(true);
            setIsLoading(false); // We are done loading, just show block screen
            return; // Stop initialization
          }
        } else {
          // If the geo IP service fails, don't block the user.
          console.warn(`GeoIP service failed with status: ${response.status}. Allowing access.`);
        }
      } catch (err) {
        console.warn('Could not perform IP location check. Allowing access.', err);
      }

      // 2. If not blocked, proceed with session check
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        const userId = parseInt(storedUserId, 10);
        if (!isNaN(userId)) {
          try {
            const user = await verifyAccessCode(String(userId), true);
            if (user) {
              if (user.is_subscription_expired) {
                  localStorage.removeItem('userId');
                  setShowExpiredSubscriptionMessage(true);
                  setError('اشتراک شما به پایان رسیده است. برای تمدید، با پشتیبانی در تلگرام در ارتباط باشید.');
              } else {
                  setCurrentUser(user);
                  setIsAdmin(isUserAdmin(user.user_id));
              }
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

    initializeApp();
  }, []);


  const handleLogin = useCallback(async (code: string): Promise<boolean> => {
    setError('');
    setShowExpiredSubscriptionMessage(false);
    setIsLoading(true);
    try {
      const user = await verifyAccessCode(code);
      if (user) {
        if (user.is_subscription_expired) {
          setShowExpiredSubscriptionMessage(true);
          setError('اشتراک شما به پایان رسیده است. برای تمدید، با پشتیبانی در تلگرام در ارتباط باشید.');
          return false;
        }
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
    // Force a reload to ensure all state is cleared and prevent auto-login loops
    window.location.reload();
  }, []);
  
  const handleUserUpdate = useCallback(async () => {
    if (!currentUser) return;
    try {
      const updatedUser = await getUserById(currentUser.user_id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    } catch (e) {
      console.error("Failed to update user:", e);
    }
  }, [currentUser]);

  const userContextValue = useMemo(() => ({
    user: currentUser,
    updateUser: handleUserUpdate,
    logout: handleLogout
  }), [currentUser, handleUserUpdate, handleLogout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader />
      </div>
    );
  }
  
  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-center p-4">
        <Icon name="lock-closed" className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white">دسترسی امکان‌پذیر نیست</h1>
        <p className="mt-2 text-slate-300">برای استفاده از برنامه، لطفاً VPN خود را روشن کنید.</p>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <UserProvider value={userContextValue}>
        <div className="min-h-screen bg-slate-900 text-slate-100">
          {!currentUser ? (
            <WelcomeScreen onLogin={handleLogin} error={error} setError={setError} showExpiredLink={showExpiredSubscriptionMessage} />
          ) : isAdmin ? (
            <AdminView />
          ) : (
            <UserView />
          )}
        </div>
      </UserProvider>
    </NotificationProvider>
  );
};

export default App;
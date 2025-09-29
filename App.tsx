
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

  useEffect(() => {
    const checkSession = async () => {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        const userId = parseInt(storedUserId, 10);
        if (!isNaN(userId)) {
          const user = await verifyAccessCode(String(userId), true);
          if (user) {
            setCurrentUser(user);
            setIsAdmin(isUserAdmin(user.user_id));
          } else {
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
        setError('خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
        return false;
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('userId');
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
import React, { useState } from 'react';
import { Loader } from '../common/Loader';

interface WelcomeScreenProps {
  onLogin: (code: string) => Promise<boolean>;
  error: string;
  setError: (error: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin, error, setError }) => {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue) return;
    setIsLoading(true);
    setError('');

    const success = await onLogin(inputValue);
    
    if (!success) {
       setInputValue('');
    }
    setIsLoading(false);
  };
  
  const toggleLoginMode = () => {
    setIsAdminLogin(!isAdminLogin);
    setInputValue('');
    setError('');
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-slate-900"
    >
      <div className="relative w-full max-w-xs p-8 space-y-4 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            سوپر ادمین آیتم
          </h1>
          
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {!isAdminLogin ? (
                <>
                  <p className="mt-2 text-slate-300">برای ورود کد دسترسی خود را وارد کنید</p>
                  <input
                    id="access-code-input"
                    name="access-code"
                    type="text"
                    autoComplete="off"
                    required
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="block w-full px-4 py-3 text-white text-center bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                    placeholder="کد دسترسی"
                  />
                </>
              ) : (
                <>
                  <p className="mt-2 text-slate-300">رمز عبور مدیر را وارد کنید</p>
                  <input
                    id="admin-password-input"
                    name="admin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="block w-full px-4 py-3 text-white text-center bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </>
              )}

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? <div className="h-5 w-5"><Loader /></div> : 'ورود'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="absolute -bottom-8 right-0 left-0 text-center">
            <button
              onClick={toggleLoginMode}
              className="text-xs font-medium text-slate-400 hover:text-violet-300 transition-colors"
            >
              {isAdminLogin ? 'بازگشت به ورود کاربر' : 'ورود مدیر'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default WelcomeScreen;
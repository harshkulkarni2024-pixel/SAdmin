
import React, { useState } from 'react';
import { Loader } from '../common/Loader';

interface WelcomeScreenProps {
  onLogin: (code: string) => Promise<boolean>;
  error: string;
  setError: (error: string) => void;
  showExpiredLink: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin, error, setError, showExpiredLink }) => {
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

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-slate-900"
    >
      <div className="w-full max-w-sm p-8 space-y-4 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            سوپر ادمین آیتم
          </h1>
          <p className="mt-2 text-slate-300">برای ورود، کد دسترسی یا رمز عبور مدیر را وارد کنید</p>
          
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                id="access-code-input"
                name="access-code"
                type="password"
                autoComplete="current-password"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="block w-full px-4 py-3 text-white text-center bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                placeholder="••••••••"
              />

            {error && <p className="text-sm text-red-400 text-center whitespace-pre-line">{error}</p>}

            <div>
              {showExpiredLink ? (
                 <a 
                    href="https://t.me/superadminitem"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 focus:ring-offset-slate-900 transition-colors duration-200"
                 >
                    تمدید اشتراک از طریق تلگرام
                 </a>
              ) : (
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {isLoading ? <div className="h-5 w-5"><Loader /></div> : 'ورود'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
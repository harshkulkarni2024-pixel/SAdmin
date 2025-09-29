import React, { useState } from 'react';
import { Icon } from '../common/Icon';

const TelegramIntegration: React.FC = () => {
    const [token, setToken] = useState('');
    const [feedback, setFeedback] = useState('');

    const handleSave = () => {
        // In a real application, this would securely send the token to a backend server.
        // For this static version, we just show feedback.
        if (token.trim()) {
            setFeedback('تنظیمات ذخیره شد. برای فعال‌سازی کامل ربات، نیاز به یک سرور بک‌اند است.');
        } else {
            setFeedback('لطفاً توکن ربات را وارد کنید.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">یکپارچه‌سازی با ربات تلگرام</h1>
            <p className="text-slate-400 mb-6">ربات تلگرام خود را برای ارسال اعلان‌ها به گروه متصل کنید.</p>

            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg mb-6">
                    <h4 className="font-bold mb-1">توجه مهم</h4>
                    <p className="text-sm">این ویژگی نیازمند یک کامپوننت سمت سرور (Backend) برای مدیریت امن توکن ربات و ارسال پیام‌ها است. در این نسخه نمایشی، توکن شما ذخیره یا استفاده نمی‌شود. این صفحه صرفاً یک نمونه اولیه برای نمایش قابلیت‌های آینده است.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="telegram-token" className="block text-sm font-medium text-slate-300 mb-2">
                            توکن ربات تلگرام
                        </label>
                        <input
                            type="text"
                            id="telegram-token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="توکن ربات خود را از BotFather دریافت کنید"
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        ذخیره تنظیمات
                    </button>
                    {feedback && <p className="text-center text-green-400 mt-4">{feedback}</p>}
                </div>
            </div>
        </div>
    );
};

export default TelegramIntegration;

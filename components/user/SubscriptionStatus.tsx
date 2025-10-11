
import React, { useState, useEffect } from 'react';
import { User, SubscriptionHistory } from '../../types';
import { getSubscriptionHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';

interface SubscriptionStatusProps {
    user: User;
    onClose: () => void;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ user, onClose }) => {
    const [history, setHistory] = useState<SubscriptionHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            const userHistory = await getSubscriptionHistory(user.user_id);
            setHistory(userHistory);
            setIsLoading(false);
        };
        fetchHistory();
    }, [user.user_id]);

    const calculateRemainingDays = (): { text: string, color: string } => {
        if (!user.subscription_expires_at) {
            return { text: 'تعریف نشده', color: 'text-yellow-400' };
        }
        const diff = new Date(user.subscription_expires_at).getTime() - new Date().getTime();
        if (diff < 0) {
            return { text: 'منقضی شده', color: 'text-red-400' };
        }
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return { text: `${days} روز باقی‌مانده`, color: 'text-green-400' };
    };

    const { text: remainingDaysText, color: remainingDaysColor } = calculateRemainingDays();

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700 m-4"
                onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icon name="user" className="w-6 h-6 text-violet-400" />
                        وضعیت اشتراک
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg text-center mb-6">
                    <p className="text-sm text-slate-400">وضعیت فعلی:</p>
                    <p className={`text-2xl font-bold ${remainingDaysColor}`}>{remainingDaysText}</p>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">تاریخچه تمدیدها</h3>
                    {isLoading ? (
                        <div className="flex justify-center py-4"><Loader /></div>
                    ) : history.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {history.map(item => (
                                <div key={item.id} className="bg-slate-700/50 p-3 rounded-lg text-sm">
                                    <p className="text-slate-300">
                                        اشتراک شما در تاریخ <span className="font-mono text-slate-400">{new Date(item.created_at).toLocaleDateString('fa-IR')}</span> به مدت <span className="font-bold text-white">{item.extended_for_days}</span> روز تمدید شد.
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-4">تاریخچه‌ای برای نمایش وجود ندارد.</p>
                    )}
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => alert('این قابلیت به زودی فعال خواهد شد.')}
                        className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a2 2 0 10-4 0v.083A6 6 0 004 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        فعال سازی نوتیفیکیشن
                    </button>
                     <a
                        href="https://t.me/superadminitem"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full block text-center px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        درخواست تمدید از پشتیبانی تلگرام
                    </a>
                </div>

            </div>
        </div>
    );
};

export default SubscriptionStatus;
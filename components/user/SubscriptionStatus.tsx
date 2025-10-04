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
                        <Icon name="crown" className="w-6 h-6 text-yellow-400" />
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
                                <div key={item.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center text-sm">
                                    <p className="text-slate-300">
                                        تمدید <span className="font-bold text-white">{item.extended_for_days}</span> روزه
                                    </p>
                                    <p className="text-slate-400 font-mono">
                                        {new Date(item.created_at).toLocaleDateString('fa-IR')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-4">تاریخچه‌ای برای نمایش وجود ندارد.</p>
                    )}
                </div>

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
    );
};

export default SubscriptionStatus;

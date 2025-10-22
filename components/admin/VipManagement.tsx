import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import * as db from '../../services/dbService';
import { Loader } from '../common/Loader';

interface VipManagementProps {
    onVipUpdate: () => void;
}

const VipManagement: React.FC<VipManagementProps> = ({ onVipUpdate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [vipStatus, setVipStatus] = useState<Record<number, boolean>>({});
    const [initialVipStatus, setInitialVipStatus] = useState<Record<number, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState('');

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        const allUsers = await db.getAllUsers();
        setUsers(allUsers);
        const statusMap = allUsers.reduce((acc, user) => {
            acc[user.user_id] = !!user.is_vip;
            return acc;
        }, {} as Record<number, boolean>);
        setVipStatus(statusMap);
        setInitialVipStatus(statusMap);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggle = (userId: number) => {
        setVipStatus(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setNotification('');
        try {
            const updatePromises = users
                .filter(user => initialVipStatus[user.user_id] !== vipStatus[user.user_id])
                .map(user => db.updateUserVipStatus(user.user_id, vipStatus[user.user_id]));
            
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                setNotification('تغییرات با موفقیت ذخیره شد.');
                onVipUpdate(); // Notify parent of the update
                await fetchUsers(); // Refetch to reset initial state
            } else {
                setNotification('هیچ تغییری برای ذخیره وجود نداشت.');
            }
            
        } catch (error) {
            const errorMessage = (error as Error).message;
            let userFriendlyMessage = `خطا در ذخیره تغییرات: ${errorMessage}`;
    
            if (errorMessage.includes('violates row-level security policy')) {
                userFriendlyMessage = `خطای دسترسی: RLS (Row-Level Security) فعال است و به شما اجازه ویرایش کاربران را نمی‌دهد.

لطفاً یک پالیسی (Policy) برای UPDATE در جدول \`users\` ایجاد کنید که به مدیر سیستم اجازه ویرایش دهد.`;
            } else if (errorMessage.includes('column "is_vip" of relation "users" does not exist')) {
                userFriendlyMessage = `خطای پایگاه داده: ستون \`is_vip\` در جدول \`users\` وجود ندارد.

لطفاً با اجرای دستور SQL زیر در Supabase SQL Editor این ستون را اضافه کنید:
\`ALTER TABLE public.users ADD COLUMN is_vip BOOLEAN DEFAULT false;\``;
            }
    
            setNotification(userFriendlyMessage);
            console.error(error);
        } finally {
            setIsSaving(false);
            setTimeout(() => setNotification(''), 5000);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center"><Loader /></div>;
    }

    return (
        <div className="animate-fade-in max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2">مدیریت کاربران VIP</h1>
            <p className="text-slate-400 mb-6">کاربرانی که می‌خواهید دسترسی VIP داشته باشند را انتخاب کنید.</p>

            {notification && (
                <div className={`px-4 py-3 rounded-lg mb-6 text-right whitespace-pre-line ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                    {notification}
                </div>
            )}

            <div className="bg-slate-800 rounded-lg mb-6 shadow-lg">
                <ul className="divide-y divide-slate-700">
                    {users.map(user => (
                        <li key={user.user_id} className="p-4 flex items-center justify-between">
                            <span className="text-white font-medium">{user.full_name}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={vipStatus[user.user_id] || false}
                                    onChange={() => handleToggle(user.user_id)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                                <span className="ms-3 text-sm font-medium text-slate-300">VIP</span>
                            </label>
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 transition-colors"
            >
                {isSaving ? <Loader /> : 'ذخیره تغییرات'}
            </button>
        </div>
    );
};

export default VipManagement;
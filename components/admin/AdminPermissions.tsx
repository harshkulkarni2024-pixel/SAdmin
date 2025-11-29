
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import * as db from '../../services/dbService';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

export const AVAILABLE_PERMISSIONS = [
    { key: 'users', label: 'مدیریت کاربران' },
    { key: 'editor_tasks', label: 'مدیریت تدوین' },
    { key: 'production_calendar', label: 'تقویم تولید' },
    { key: 'vip_management', label: 'مدیریت VIP' },
    { key: 'algorithm_news', label: 'اخبار الگوریتم' },
    { key: 'activity', label: 'گزارش فعالیت‌ها' },
    { key: 'checklist', label: 'چک‌لیست شخصی' }, // Basic access
];

const AdminPermissions: React.FC = () => {
    const showNotification = useNotification();
    const [admins, setAdmins] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAdmins = async () => {
        setIsLoading(true);
        try {
            const allAdmins = await db.getAllAdmins();
            setAdmins(allAdmins);
        } catch (e) {
            showNotification('خطا در بارگذاری لیست مدیران.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const handlePermissionChange = async (adminId: number, permKey: string, isChecked: boolean) => {
        const admin = admins.find(a => a.user_id === adminId);
        if (!admin) return;

        const currentPerms = (admin.permissions as string[]) || [];
        let newPerms;
        if (isChecked) {
            newPerms = [...currentPerms, permKey];
        } else {
            newPerms = currentPerms.filter(p => p !== permKey);
        }

        // Optimistic update
        setAdmins(prev => prev.map(a => a.user_id === adminId ? { ...a, permissions: newPerms } : a));

        try {
            await db.updateUserPermissions(adminId, newPerms);
            showNotification('دسترسی بروزرسانی شد.', 'success');
        } catch (e) {
            showNotification('خطا در ذخیره دسترسی.', 'error');
            fetchAdmins(); // Revert
        }
    };

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-6">سطح دسترسی ادمین‌ها</h1>
            <p className="text-slate-400 mb-8">در این بخش می‌توانید تعیین کنید کدام ادمین به کدام بخش از پنل مدیریت دسترسی داشته باشد.</p>

            <div className="space-y-6">
                {admins.length === 0 ? (
                    <p className="text-slate-500 text-center">هیچ ادمین دیگری تعریف نشده است.</p>
                ) : (
                    admins.map(admin => (
                        <div key={admin.user_id} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{admin.full_name}</h3>
                                    <p className="text-slate-400 font-mono text-sm mt-1">{admin.access_code}</p>
                                </div>
                                <span className="px-3 py-1 bg-violet-600/20 text-violet-300 rounded-full text-xs border border-violet-500/50">Admin</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {AVAILABLE_PERMISSIONS.map(perm => {
                                    const hasPerm = (admin.permissions as string[])?.includes(perm.key);
                                    return (
                                        <label key={perm.key} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 cursor-pointer transition-colors border border-slate-700/50">
                                            <input 
                                                type="checkbox"
                                                checked={hasPerm || false}
                                                onChange={(e) => handlePermissionChange(admin.user_id, perm.key, e.target.checked)}
                                                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-violet-600 focus:ring-violet-500"
                                            />
                                            <span className={`text-sm ${hasPerm ? 'text-white' : 'text-slate-400'}`}>{perm.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminPermissions;

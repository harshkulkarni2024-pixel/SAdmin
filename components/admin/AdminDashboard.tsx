
import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { Icon } from '../common/Icon';
import AdminChecklist from './AdminChecklist';
import { AdminViewType } from './AdminView';
import * as db from '../../services/dbService';

interface AdminDashboardProps {
  onNavigate: (view: AdminViewType) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalEditors: 0,
        totalTasks: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            const users = await db.getAllUsers();
            const editors = await db.getAllEditors();
            const tasks = await db.getEditorTasks();
            
            // Simple logic for active users (e.g. verified or recent activity)
            // Assuming verified is active for now
            const active = users.filter(u => u.is_verified).length;
            
            setStats({
                totalUsers: users.length,
                activeUsers: active,
                totalEditors: editors.length,
                totalTasks: tasks.length
            });
        };
        fetchStats();
    }, []);

    const cards = [
        { title: 'کاربران کل', value: stats.totalUsers, icon: 'users', view: 'users', color: 'bg-blue-500' },
        { title: 'کاربران فعال', value: stats.activeUsers, icon: 'check-circle', view: 'users', color: 'bg-green-500' },
        { title: 'تیم تدوین', value: stats.totalEditors, icon: 'video', view: 'editor_tasks', color: 'bg-purple-500' },
        { title: 'پروژه‌های تدوین', value: stats.totalTasks, icon: 'clipboard-list', view: 'editor_tasks', color: 'bg-orange-500' },
    ];

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">داشبورد مدیریت</h1>
                <p className="text-slate-400 mt-1">آمار کلی و وضعیت کاربران در یک نگاه.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => (
                    <button 
                        key={index} 
                        onClick={() => onNavigate(card.view as AdminViewType)}
                        className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-violet-500/50 transition-all text-right group"
                    >
                        <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                            <Icon name={card.icon as any} className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-slate-400 text-sm font-medium">{card.title}</h3>
                        <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                    </button>
                ))}
            </div>

            {/* Additional Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button onClick={() => onNavigate('vip_management')} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500/20 p-3 rounded-full text-amber-500">
                             <Icon name="crown" className="w-8 h-8" />
                        </div>
                        <div className="text-right">
                            <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors">مدیریت VIP</h3>
                            <p className="text-sm text-slate-400">مدیریت دسترسی‌های ویژه کاربران</p>
                        </div>
                    </div>
                    <Icon name="back" className="w-6 h-6 text-slate-500 rotate-180" />
                </button>
                
                 <button onClick={() => onNavigate('production_calendar')} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                        <div className="bg-sky-500/20 p-3 rounded-full text-sky-500">
                             <Icon name="calendar" className="w-8 h-8" />
                        </div>
                        <div className="text-right">
                            <h3 className="font-bold text-lg text-white group-hover:text-sky-400 transition-colors">تقویم تولید</h3>
                            <p className="text-sm text-slate-400">زمان‌بندی ضبط و تولید محتوا</p>
                        </div>
                    </div>
                    <Icon name="back" className="w-6 h-6 text-slate-500 rotate-180" />
                </button>
            </div>

            {/* Admin Checklist Widget - Moved to Bottom */}
            <div className="w-full h-96">
                <div className="flex justify-between items-center mb-2 px-1">
                    <h3 className="font-bold text-white">چک‌لیست فوری</h3>
                    <button onClick={() => onNavigate('checklist')} className="text-sm text-violet-400 hover:text-violet-300 flex items-center">
                        مشاهده تمام صفحه
                        <Icon name="back" className="w-4 h-4 ml-1 rotate-180" />
                    </button>
                </div>
                <div className="h-full">
                    <AdminChecklist />
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

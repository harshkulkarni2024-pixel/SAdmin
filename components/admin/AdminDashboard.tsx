
import React from 'react';
import { Icon } from '../common/Icon';
import AdminChecklist from './AdminChecklist';
import { AdminViewType } from './AdminView';

interface AdminDashboardProps {
  onNavigate: (view: AdminViewType) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    
    const menuItems = [
        { id: 'checklist', label: 'چک‌لیست (تمام صفحه)', icon: 'clipboard-list', color: 'text-violet-400', bg: 'bg-violet-500/20' },
        { id: 'production_calendar', label: 'تقویم تولید', icon: 'calendar', color: 'text-sky-400', bg: 'bg-sky-500/20' },
        { id: 'editor_tasks', label: 'مدیریت تدوین', icon: 'video', color: 'text-purple-400', bg: 'bg-purple-500/20' },
        { id: 'users', label: 'مدیریت کاربران', icon: 'users', color: 'text-blue-400', bg: 'bg-blue-500/20' },
        { id: 'vip_management', label: 'مدیریت VIP', icon: 'key', color: 'text-amber-400', bg: 'bg-amber-500/20' },
        { id: 'algorithm_news', label: 'اخبار الگوریتم', icon: 'broadcast', color: 'text-pink-400', bg: 'bg-pink-500/20' },
        { id: 'activity', label: 'گزارش فعالیت‌ها', icon: 'document-text', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    ];

    return (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-6rem)] pb-2 gap-4">
            
            {/* 1. Main Checklist Section (Dominant) */}
            <div className="flex-1 min-h-0">
                <AdminChecklist />
            </div>

            {/* 2. Quick Access Grid (Compact) */}
            <div className="flex-shrink-0">
                <h3 className="text-white font-bold text-sm mb-2 px-1 opacity-80">دسترسی سریع</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {menuItems.map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => onNavigate(item.id as AdminViewType)}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all group"
                        >
                            <div className={`p-2 rounded-full ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                                <Icon name={item.icon as any} className="w-5 h-5" />
                            </div>
                            <span className="text-[11px] font-medium text-slate-300 text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;


import React from 'react';
import { Icon } from '../common/Icon';
import AdminChecklist from './AdminChecklist';
import { AdminViewType } from './AdminView';
import { useUser } from '../../contexts/UserContext';

interface AdminDashboardProps {
  onNavigate: (view: AdminViewType) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const { user } = useUser();
    
    // Define all potential menu items
    const allMenuItems = [
        { id: 'checklist', label: 'چک‌لیست', icon: 'clipboard-list', color: 'text-violet-400', bg: 'bg-violet-500/20' },
        { id: 'production_calendar', label: 'تقویم تولید', icon: 'calendar', color: 'text-sky-400', bg: 'bg-sky-500/20' },
        { id: 'editor_tasks', label: 'مدیریت تدوین', icon: 'video', color: 'text-purple-400', bg: 'bg-purple-500/20' },
        { id: 'users', label: 'مدیریت کاربران', icon: 'users', color: 'text-blue-400', bg: 'bg-blue-500/20' },
        { id: 'algorithm_news', label: 'اخبار الگوریتم', icon: 'broadcast', color: 'text-pink-400', bg: 'bg-pink-500/20' },
    ];

    // Filter items based on permissions
    const isManager = user?.role === 'manager';
    const menuItems = allMenuItems.filter(item => {
        if (isManager) return true;
        const perms = (user?.permissions as string[]) || [];
        // Checklist is usually basic, but let's check
        if (item.id === 'checklist') return true; 
        return perms.includes(item.id);
    });

    return (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-6rem)] pb-2 gap-4">
            
            {/* 1. Main Checklist Section (Full Screen / 2x Size) */}
            <div className="flex-1 min-h-0 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl flex flex-col">
                 <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icon name="clipboard-list" className="w-6 h-6 text-violet-400"/>
                        اقدامات
                    </h2>
                </div>
                <div className="flex-1 overflow-hidden p-1">
                    <AdminChecklist />
                </div>
            </div>

            {/* 2. Quick Access Grid (Compact & Minimal) */}
            <div className="flex-shrink-0">
                <div className="grid grid-cols-5 gap-3">
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

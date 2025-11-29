
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User } from '../../types';
import { Icon } from '../common/Icon';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import UserDetails from './UserDetails';
import ActivityLog from './ActivityLog';
import VipManagement from './VipManagement';
import AlgorithmNewsEditor from './AlgorithmNewsEditor'; 
import EditorTaskManagement from './EditorTaskManagement';
import ProductionCalendar from './ProductionCalendar';
import AdminChecklist from './AdminChecklist';
import AdminPermissions from './AdminPermissions'; // Import new component
import * as db from '../../services/dbService';
import { useUser } from '../../contexts/UserContext';

interface AdminViewProps {
  // Props are now handled by context
}

export type AdminViewType = 'dashboard' | 'users' | 'activity' | 'vip_management' | 'algorithm_news' | 'editor_tasks' | 'production_calendar' | 'checklist' | 'permissions';

const AdminView: React.FC<AdminViewProps> = () => {
  const { user, logout: onLogout } = useUser();
  const [activeView, setActiveView] = useState<AdminViewType>('dashboard');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [notifications, setNotifications] = useState({ ideas: 0, logs: 0, tasks: 0 });
  const [userListVersion, setUserListVersion] = useState(0);

  const isManager = user?.role === 'manager'; // Check if Super Admin/Manager

  const checkPermission = useCallback((view: AdminViewType) => {
      if (isManager) return true; // Manager has all permissions
      if (view === 'dashboard') return true; // Dashboard is always accessible
      const perms = (user?.permissions as string[]) || [];
      return perms.includes(view);
  }, [isManager, user?.permissions]);

  const refreshNotifications = useCallback(async () => {
    const counts = await db.getAdminNotificationCounts();
    setNotifications(counts);
  }, []);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 5000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
            setIsSidebarOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);


  useEffect(() => {
    const handlePopState = async (event: PopStateEvent) => {
        const state = event.state;
        if (state?.adminView === 'userDetails' && state.userId) {
            if (!checkPermission('users')) return;
            const allUsers = await db.getAllUsers();
            const userToSelect = allUsers.find(u => u.user_id === state.userId);
            if (userToSelect) {
                setSelectedUser(userToSelect);
                setActiveView('users');
            } else {
                setSelectedUser(null);
                setActiveView('dashboard');
                history.replaceState({ adminView: 'dashboard' }, '', '#dashboard');
            }
        } else if (state?.adminView) {
            if (checkPermission(state.adminView)) {
                setSelectedUser(null);
                setActiveView(state.adminView as AdminViewType);
            } else {
                setActiveView('dashboard');
            }
        } else {
            setSelectedUser(null);
            setActiveView('dashboard');
        }
    };

    window.addEventListener('popstate', handlePopState);

    const initializeView = async () => {
        const hash = window.location.hash.replace('#', '');
        if (hash.startsWith('users/') && checkPermission('users')) {
            const userId = parseInt(hash.split('/')[1], 10);
            const allUsers = await db.getAllUsers();
            const userToSelect = userId ? allUsers.find(u => u.user_id === userId) : null;
            if (userToSelect) {
                setSelectedUser(userToSelect);
                setActiveView('users');
                history.replaceState({ adminView: 'userDetails', userId }, '', `#users/${userId}`);
            }
        } else if (hash && checkPermission(hash as AdminViewType)) {
            setActiveView(hash as AdminViewType);
            setSelectedUser(null);
            history.replaceState({ adminView: hash }, '', `#${hash}`);
        } else {
            setActiveView('dashboard');
            setSelectedUser(null);
            history.replaceState({ adminView: 'dashboard' }, '', '#dashboard');
        }
    };
    
    initializeView();
    
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [checkPermission]);

  const handleSelectUser = useCallback((user: User) => {
    history.pushState({ adminView: 'userDetails', userId: user.user_id }, '', `#users/${user.user_id}`);
    setSelectedUser(user);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedUser(null);
    history.pushState({ adminView: 'users' }, '', '#users');
    refreshNotifications();
    setUserListVersion(v => v + 1);
  }, [refreshNotifications]);
  
  const handleVipUpdate = useCallback(() => {
    setUserListVersion(v => v + 1);
  }, []);

  const handleViewChange = (view: AdminViewType) => {
    if (!checkPermission(view)) {
        alert('شما دسترسی به این بخش را ندارید.');
        return;
    }
    if (window.location.hash !== `#${view}` || selectedUser) {
        history.pushState({ adminView: view }, '', `#${view}`);
    }
    setActiveView(view);
    setSelectedUser(null);
    setIsSidebarOpen(false);
  };

  if (!user) {
    return <div>Loading admin...</div>
  }

  const NavItem: React.FC<{ view: AdminViewType; icon: React.ComponentProps<typeof Icon>['name']; label: string, count?: number }> = ({ view, icon, label, count = 0 }) => {
      // Don't render if no permission
      if (!checkPermission(view)) return null;

      return (
        <li>
        <button
            onClick={() => handleViewChange(view)}
            title={label}
            className={`relative flex items-center w-full p-3 rounded-lg transition-colors duration-200 text-right ${
            activeView === view && !selectedUser ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            } ${!isSidebarOpen && 'justify-center'}`}
        >
            <Icon name={icon} className="w-6 h-6 flex-shrink-0" />
            <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${isSidebarOpen ? "w-auto opacity-100 ms-4" : "w-0 opacity-0 ms-0"}`}>{label}</span>
            {count > 0 && (
                <span className={`absolute top-1.5 ${isSidebarOpen ? 'left-2' : 'right-1.5'}  bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full`}>
                    {count}
                </span>
            )}
        </button>
        </li>
      );
  };

  const renderContent = () => {
    if (selectedUser) {
      return <UserDetails user={selectedUser} onBack={handleBackToList} onUpdate={refreshNotifications} />;
    }

    if (!checkPermission(activeView)) {
        return <div className="text-center p-10 text-red-400">دسترسی غیرمجاز</div>;
    }

    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard onNavigate={handleViewChange} />;
      case 'users':
        return <UserManagement key={userListVersion} onSelectUser={handleSelectUser} />;
      case 'vip_management':
        return <VipManagement onVipUpdate={handleVipUpdate} />;
      case 'algorithm_news':
        return <AlgorithmNewsEditor />;
      case 'editor_tasks':
        return <EditorTaskManagement />;
      case 'production_calendar':
        return <ProductionCalendar />;
      case 'checklist':
        return <div className="h-full"><AdminChecklist /></div>;
      case 'activity':
        return <ActivityLog />;
      case 'permissions':
        return <AdminPermissions />;
      default:
        return <AdminDashboard onNavigate={handleViewChange} />;
    }
  };
  
  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col">
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      <header className="flex-shrink-0 bg-slate-900/80 backdrop-blur-lg flex items-center h-20 px-6 border-b border-slate-800 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <button ref={menuButtonRef} onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white lg:hidden" aria-label="باز کردن منو">
                  <Icon name="menu" className="w-6 h-6"/>
              </button>
          </div>
          <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">
                  {isManager ? 'پنل مدیریت (Manager)' : 'پنل ادمین (Admin)'}
              </h1>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside ref={sidebarRef} className={`fixed lg:relative top-20 bottom-0 lg:top-auto lg:h-full flex-shrink-0 bg-slate-950 flex flex-col transition-all duration-300 ease-in-out z-30 ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'}`}>
          <div className="flex-grow overflow-y-auto">
            <nav className="p-4 mt-4">
              <ul className="space-y-2">
                  <NavItem view="dashboard" icon="dashboard" label="داشبورد" />
                  <NavItem view="checklist" icon="clipboard-list" label="اقدامات" />
                  
                  {isManager && <div className="pt-2 mt-2 border-t border-slate-800/50"><span className="text-xs text-slate-500 px-2">مدیریت کل</span></div>}
                  {isManager && <NavItem view="permissions" icon="lock-closed" label="سطح دسترسی ادمین‌ها" />}
                  
                  <div className="pt-2 mt-2 border-t border-slate-800/50"></div>
                  <NavItem view="editor_tasks" icon="video" label="مدیریت تدوین" count={notifications.tasks} />
                  <NavItem view="production_calendar" icon="calendar" label="تقویم تولید" />
                  <NavItem view="users" icon="users" label="کاربران" count={notifications.ideas}/>
                  <NavItem view="vip_management" icon="key" label="مدیریت VIP" />
                  <NavItem view="algorithm_news" icon="broadcast" label="اخبار الگوریتم" />
                  <NavItem view="activity" icon="document-text" label="آخرین فعالیت‌ها" count={notifications.logs} />
              </ul>
            </nav>
          </div>
          <div className="border-t border-slate-800 p-4 flex-shrink-0">
            <div className={`flex items-center gap-3 w-full p-2 rounded-lg mb-2 overflow-hidden ${!isSidebarOpen && 'justify-center'}`}>
              <Icon name="user" className="w-8 h-8 text-slate-400 flex-shrink-0" />
              <span className={`font-semibold text-white truncate transition-all duration-200 ${isSidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"}`}>{user.full_name}</span>
            </div>
            <button
                  onClick={onLogout}
                  title={!isSidebarOpen ? 'خروج' : ''}
                  className={`flex items-center w-full p-3 text-sm font-medium rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-colors duration-200 ${!isSidebarOpen && 'justify-center'}`}
              >
                  <Icon name="logout" className="w-6 h-6 flex-shrink-0" />
                  <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${isSidebarOpen ? "w-auto opacity-100 ms-4" : "w-0 opacity-0 ms-0"}`}>خروج</span>
              </button>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminView;

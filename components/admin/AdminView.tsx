import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User } from '../../types';
import { Icon } from '../common/Icon';
import UserManagement from './UserManagement';
import Broadcast from './Broadcast';
import UserDetails from './UserDetails';
import ActivityLog from './ActivityLog';
import * as db from '../../services/dbService';

interface AdminViewProps {
  user: User;
  onLogout: () => void;
}

type AdminViewType = 'users' | 'broadcast' | 'activity';

const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState<AdminViewType>('users');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [notifications, setNotifications] = useState({ ideas: 0, logs: 0 });

  const refreshNotifications = useCallback(async () => {
    const counts = await db.getAdminNotificationCounts();
    setNotifications(counts);
  }, []);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 5000); // Poll for new notifications
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
            const allUsers = await db.getAllUsers();
            const userToSelect = allUsers.find(u => u.user_id === state.userId);
            if (userToSelect) {
                setSelectedUser(userToSelect);
                setActiveView('users');
            } else {
                setSelectedUser(null);
                setActiveView('users');
                history.replaceState({ adminView: 'users' }, '', '#users');
            }
        } else if (state?.adminView) {
            setSelectedUser(null);
            setActiveView(state.adminView);
        } else {
            setSelectedUser(null);
            setActiveView('users');
        }
    };

    window.addEventListener('popstate', handlePopState);

    const initializeView = async () => {
        const hash = window.location.hash.replace('#', '');
        if (hash.startsWith('users/')) {
            const userId = parseInt(hash.split('/')[1], 10);
            const allUsers = await db.getAllUsers();
            const userToSelect = userId ? allUsers.find(u => u.user_id === userId) : null;
            if (userToSelect) {
                setSelectedUser(userToSelect);
                setActiveView('users');
                history.replaceState({ adminView: 'userDetails', userId }, '', `#users/${userId}`);
            }
        } else if (hash === 'broadcast' || hash === 'activity') {
            setActiveView(hash as AdminViewType);
            setSelectedUser(null);
            history.replaceState({ adminView: hash }, '', `#${hash}`);
        } else {
            setActiveView('users');
            setSelectedUser(null);
            history.replaceState({ adminView: 'users' }, '', '#users');
        }
    };
    
    initializeView();
    
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleSelectUser = useCallback((user: User) => {
    history.pushState({ adminView: 'userDetails', userId: user.user_id }, '', `#users/${user.user_id}`);
    setSelectedUser(user);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedUser(null);
    history.pushState({ adminView: 'users' }, '', '#users');
    refreshNotifications();
  }, [refreshNotifications]);

  const handleViewChange = (view: AdminViewType) => {
    if (window.location.hash !== `#${view}` || selectedUser) {
        history.pushState({ adminView: view }, '', `#${view}`);
    }
    setActiveView(view);
    setSelectedUser(null);
    setIsSidebarOpen(false);
  };

  const NavItem: React.FC<{ view: AdminViewType; icon: React.ComponentProps<typeof Icon>['name']; label: string, count: number }> = ({ view, icon, label, count }) => (
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

  const renderContent = () => {
    if (selectedUser) {
      return <UserDetails user={selectedUser} onBack={handleBackToList} onUpdate={refreshNotifications} />;
    }

    switch (activeView) {
      case 'users':
        return <UserManagement onSelectUser={handleSelectUser} onLogout={onLogout} />;
      case 'broadcast':
        return <Broadcast />;
      case 'activity':
        return <ActivityLog />;
      default:
        return <UserManagement onSelectUser={handleSelectUser} onLogout={onLogout} />;
    }
  };
  
  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col">
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      <header className="flex-shrink-0 bg-slate-900/80 backdrop-blur-lg flex items-center h-20 px-6 border-b border-slate-800 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <button ref={menuButtonRef} onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white lg:hidden">
                  <Icon name="menu" className="w-6 h-6"/>
              </button>
          </div>
          <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">پنل مدیریت سوپرادمین آیتــم</h1>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside ref={sidebarRef} className={`fixed lg:relative top-20 bottom-0 lg:top-auto lg:h-full flex-shrink-0 bg-slate-950 flex flex-col transition-all duration-300 ease-in-out z-30 ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'}`}>
          <div className="flex-grow overflow-y-auto">
            <nav className="p-4 mt-4">
              <ul className="space-y-2">
                  <NavItem view="users" icon="users" label="کاربران" count={notifications.ideas}/>
                  <NavItem view="broadcast" icon="broadcast" label="ارسال اطلاعیه" count={0} />
                  <NavItem view="activity" icon="document-text" label="آخرین فعالیت‌ها" count={notifications.logs} />
              </ul>
            </nav>
          </div>
          <div className="border-t border-slate-800 p-4 flex-shrink-0">
            <div className={`flex items-center gap-3 w-full p-2 rounded-lg mb-2 overflow-hidden ${!isSidebarOpen && 'justify-center'}`}>
              <Icon name="user" className="w-8 h-8 text-slate-400 flex-shrink-0" />
              <span className={`font-semibold text-white truncate transition-all duration-200 ${isSidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"}`}>{user.full_name}</span>
            </div>
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
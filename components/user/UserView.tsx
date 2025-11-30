
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../../types';
import { Icon } from '../common/Icon';
import UserDashboard from './UserDashboard';
import StoryGenerator from './StoryGenerator';
import PostScenarios from './PostScenarios';
import UpcomingPlans from './UpcomingPlans';
import Reports from './Reports';
import Captions from './Captions';
import FreeChat from './FreeChat';
import PostIdea from './PostIdea';
import AlgorithmNews from './AlgorithmNews';
import CompetitorAnalysis from './CompetitorAnalysis';
import LiveChat from './LiveChat';
import SubscriptionStatus from './SubscriptionStatus';
import StoryImageCreator from './StoryImageCreator'; // Import new component
import * as db from '../../services/dbService';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

interface UserViewProps {
  // Props are now handled by context
}

export type UserViewType = 'dashboard' | 'story' | 'post_scenario' | 'plans' | 'reports' | 'caption' | 'chat' | 'live_chat' | 'post_idea' | 'algorithm_news' | 'competitor_analysis' | 'story_image';

const VALID_VIEWS: UserViewType[] = ['dashboard', 'story', 'post_scenario', 'plans', 'reports', 'caption', 'chat', 'live_chat', 'post_idea', 'algorithm_news', 'competitor_analysis', 'story_image'];

const VIEW_NAMES: Record<UserViewType, string> = {
    dashboard: 'داشبورد',
    story: 'سناریو استوری',
    post_scenario: 'سناریوهای پست',
    plans: 'برنامه‌ها',
    reports: 'گزارشات',
    caption: 'کپشن‌ها',
    chat: 'گفتگو',
    live_chat: 'گفتگوی زنده',
    post_idea: 'ارسال ایده',
    algorithm_news: 'اخبار الگوریتم',
    competitor_analysis: 'تحلیل رقبا',
    story_image: 'ساخت استوری تصویری',
};

const VIP_VIEWS: UserViewType[] = ['post_scenario', 'plans', 'reports', 'post_idea'];

const UserView: React.FC<UserViewProps> = () => {
  const { user, logout: onLogout, updateUser: onUserUpdate } = useUser();
  const showNotification = useNotification();
  const [activeView, setActiveView] = useState<UserViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(target) && menuButtonRef.current && !menuButtonRef.current.contains(target)) {
            setIsSidebarOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  const handleHashChange = useCallback(() => {
    if (!user) return;
    const hash = window.location.hash.replace('#', '');
    let newView = VALID_VIEWS.find(v => v === hash) || 'dashboard';
    if (VIP_VIEWS.includes(newView) && !user.is_vip) {
        newView = 'dashboard';
    }
    if (newView !== activeView) {
        setActiveView(newView);
    }
  }, [user, activeView]);

  useEffect(() => {
    if (!user) return;
    const handlePopState = (event: PopStateEvent) => {
        const view = event.state?.userView || 'dashboard';
        if (VALID_VIEWS.includes(view)) {
            if (VIP_VIEWS.includes(view) && !user.is_vip) {
                setActiveView('dashboard');
                history.replaceState({ userView: 'dashboard' }, '', '#dashboard');
            } else {
                setActiveView(view);
            }
        }
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    
    // Initial load handling
    handleHashChange();

    return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, [user, handleHashChange]);


  const handleViewChange = useCallback((view: UserViewType) => {
    if (!user) return;

    if (view === 'live_chat') {
        showNotification('این بخش به زودی فعال خواهد شد.', 'info');
        return;
    }

    if (VIP_VIEWS.includes(view) && !user.is_vip) {
        alert('برای ورود به بخش VIP با پشتیبانی در ارتباط باشید');
        return;
    }

    if (view !== activeView) {
        try {
          history.pushState({ userView: view }, '', `#${view}`);
        } catch(e) {
          console.warn("Could not push history state:", e);
        }
        setActiveView(view);
        if (view !== 'dashboard') {
            db.logActivity(user.user_id, `بخش «${VIEW_NAMES[view]}» را مشاهده کرد.`);
        }
    }
    setIsSidebarOpen(false);
  }, [activeView, user, showNotification]);
  
  if (!user) {
    // This should not happen if App component logic is correct, but it's a good safeguard.
    return <div>Loading user...</div>;
  }
  
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <UserDashboard setActiveView={handleViewChange} />;
      case 'chat':
        return <FreeChat setActiveView={handleViewChange} />;
      case 'live_chat':
        return <LiveChat />;
      case 'algorithm_news':
        return <AlgorithmNews />;
      case 'competitor_analysis':
        return <CompetitorAnalysis />;
      case 'story':
        return <StoryGenerator />;
      case 'story_image':
        return <StoryImageCreator />;
      case 'post_scenario':
        return user.is_vip ? <PostScenarios setActiveView={handleViewChange} /> : <UserDashboard setActiveView={handleViewChange} />;
      case 'plans':
        return user.is_vip ? <UpcomingPlans /> : <UserDashboard setActiveView={handleViewChange} />;
      case 'reports':
        return user.is_vip ? <Reports /> : <UserDashboard setActiveView={handleViewChange} />;
      case 'caption':
        return <Captions />;
      case 'post_idea':
        return user.is_vip ? <PostIdea setActiveView={handleViewChange} /> : <UserDashboard setActiveView={handleViewChange} />;
      default:
        return <UserDashboard setActiveView={handleViewChange} />;
    }
  };

  const NavItem: React.FC<{ view: UserViewType; icon: React.ComponentProps<typeof Icon>['name']; label: string, isVip?: boolean }> = ({ view, icon, label, isVip = false }) => (
    <li>
      <button
        onClick={() => handleViewChange(view)}
        title={label}
        className={`flex items-center w-full p-3 rounded-lg transition-colors duration-200 text-right ${
          activeView === view ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
        } ${!isSidebarOpen && 'justify-center'}`}
      >
        <Icon name={icon} className="w-6 h-6 flex-shrink-0" />
        <span className={`flex items-center overflow-hidden transition-all duration-200 whitespace-nowrap ${isSidebarOpen ? "w-auto opacity-100 ms-4" : "w-0 opacity-0 ms-0"}`}>
          {label}
          {isVip && (
              <span className="ms-2 text-xs bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-md shadow-violet-500/50">VIP</span>
          )}
        </span>
      </button>
    </li>
  );

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col">
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
       {isSubscriptionModalOpen && <SubscriptionStatus onClose={() => setIsSubscriptionModalOpen(false)} />}
       <header className="flex-shrink-0 bg-slate-900/80 backdrop-blur-lg flex items-center h-20 px-6 border-b border-slate-800 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <button ref={menuButtonRef} onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white lg:hidden" aria-label="باز کردن منو">
                  <Icon name="menu" className="w-6 h-6"/>
              </button>
          </div>
          <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">سوپرادمین آیتــم</h1>
          </div>
           <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={() => setIsSubscriptionModalOpen(true)} className="p-2 text-slate-300 hover:text-white relative" title="حساب کاربری">
                    <Icon name="user" className="w-7 h-7"/>
                </button>
            </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside ref={sidebarRef} className={`fixed lg:relative top-20 bottom-0 lg:top-auto lg:h-full flex-shrink-0 bg-slate-950 flex flex-col transition-all duration-300 ease-in-out z-30 ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'}`}>
          <div className="flex-grow overflow-y-auto">
            <nav className="p-4 mt-4">
              <ul className="space-y-2">
                  <NavItem view="dashboard" icon="dashboard" label="داشبورد" />
                  <NavItem view="chat" icon="chat" label="گفتگو با هوش مصنوعی" />
                  <NavItem view="live_chat" icon="phone-wave" label="گفتگوی زنده (بزودی)" />
                  <NavItem view="story" icon="scenario" label="سناریو استوری" />
                  <NavItem view="story_image" icon="sparkles" label="ساخت استوری تصویری" />
                  <NavItem view="caption" icon="caption" label="کپشن‌ها" />
                  <NavItem view="competitor_analysis" icon="chart-bar" label="تحلیل رقبا" />
                  <NavItem view="algorithm_news" icon="broadcast" label="اخبار الگوریتم" />
                  <div className="pt-2 mt-2 border-t border-slate-800"></div>
                  <NavItem view="post_scenario" icon="document-text" label="سناریوهای پست" isVip />
                  <NavItem view="plans" icon="plan" label="برنامه‌ها" isVip />
                  <NavItem view="post_idea" icon="idea" label="ارسال ایده" isVip />
                  <NavItem view="reports" icon="report" label="گزارشات" isVip />
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
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default UserView;

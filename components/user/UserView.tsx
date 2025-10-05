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
import SubscriptionStatus from './SubscriptionStatus'; // New import
import { logActivity } from '../../services/dbService';

interface UserViewProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: () => void;
}

export type UserViewType = 'dashboard' | 'story' | 'post_scenario' | 'plans' | 'reports' | 'caption' | 'chat' | 'live_chat' | 'post_idea' | 'algorithm_news' | 'competitor_analysis';

const VALID_VIEWS: UserViewType[] = ['dashboard', 'story', 'post_scenario', 'plans', 'reports', 'caption', 'chat', 'live_chat', 'post_idea', 'algorithm_news', 'competitor_analysis'];

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
};

const VIP_VIEWS: UserViewType[] = ['post_scenario', 'plans', 'reports', 'post_idea', 'live_chat'];

const UserView: React.FC<UserViewProps> = ({ user, onLogout, onUserUpdate }) => {
  const [activeView, setActiveView] = useState<UserViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleHashChange = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    let newView = VALID_VIEWS.find(v => v === hash) || 'dashboard';
    if (VIP_VIEWS.includes(newView) && !user.is_vip) {
        newView = 'dashboard';
    }
    if (newView !== activeView) {
        setActiveView(newView);
    }
  }, [user.is_vip, activeView]);

  useEffect(() => {
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
  }, [user.is_vip, handleHashChange]);


  const handleViewChange = useCallback((view: UserViewType) => {
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
            logActivity(user.user_id, `بخش «${VIEW_NAMES[view]}» را مشاهده کرد.`);
        }
    }
    setIsSidebarOpen(false);
  }, [activeView, user.user_id, user.is_vip]);
  
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'chat':
        return <FreeChat user={user} onUserUpdate={onUserUpdate} />;
      case 'live_chat':
        return user.is_vip ? <LiveChat user={user} /> : <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'algorithm_news':
        return <AlgorithmNews />;
      case 'competitor_analysis':
        return <CompetitorAnalysis user={user} />;
      case 'story':
        return <StoryGenerator user={user} onUserUpdate={onUserUpdate} />;
      case 'post_scenario':
        return user.is_vip ? <PostScenarios user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} /> : <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'plans':
        return user.is_vip ? <UpcomingPlans user={user} onUserUpdate={onUserUpdate} /> : <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'reports':
        return user.is_vip ? <Reports user={user} onUserUpdate={onUserUpdate} /> : <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'caption':
        return <Captions user={user} onUserUpdate={onUserUpdate} />;
      case 'post_idea':
        return user.is_vip ? <PostIdea user={user} setActiveView={handleViewChange} /> : <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      default:
        return <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
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
       {isSubscriptionModalOpen && <SubscriptionStatus user={user} onClose={() => setIsSubscriptionModalOpen(false)} />}
       <header className="flex-shrink-0 bg-slate-900/80 backdrop-blur-lg flex items-center h-20 px-6 border-b border-slate-800 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <button ref={menuButtonRef} onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white lg:hidden">
                  <Icon name="menu" className="w-6 h-6"/>
              </button>
          </div>
          <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">سوپرادمین آیتــم</h1>
          </div>
           <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <button onClick={() => setIsSubscriptionModalOpen(true)} className="p-2 text-slate-300 hover:text-white relative" title="وضعیت اشتراک">
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
                  <NavItem view="story" icon="scenario" label="سناریو استوری" />
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
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../../types';
import { Icon } from '../common/Icon';
import UserDashboard from './UserDashboard';
import StoryGenerator from './StoryGenerator';
import PostScenarios from './PostScenarios';
import UpcomingPlans from './UpcomingPlans';
import Reports from './Reports';
import ImageGenerator from './ImageGenerator';
import Captions from './Captions';
import FreeChat from './FreeChat';
import PostIdea from './PostIdea';
import AlgorithmNews from './AlgorithmNews';
import { logActivity } from '../../services/dbService';

interface UserViewProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: () => void;
}

export type UserViewType = 'dashboard' | 'story' | 'post_scenario' | 'plans' | 'reports' | 'image_video' | 'caption' | 'chat' | 'post_idea' | 'algorithm_news';

const VALID_VIEWS: UserViewType[] = ['dashboard', 'story', 'post_scenario', 'plans', 'reports', 'image_video', 'caption', 'chat', 'post_idea', 'algorithm_news'];

const VIEW_NAMES: Record<UserViewType, string> = {
    dashboard: 'داشبورد',
    story: 'سناریو استوری',
    post_scenario: 'سناریوهای پست',
    plans: 'برنامه‌ها',
    reports: 'گزارشات',
    image_video: 'تولید عکس',
    caption: 'کپشن‌ها',
    chat: 'گفتگو',
    post_idea: 'ارسال ایده',
    algorithm_news: 'اخبار الگوریتم',
};

const UserView: React.FC<UserViewProps> = ({ user, onLogout, onUserUpdate }) => {
  const [activeView, setActiveView] = useState<UserViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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


  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        const view = event.state?.userView || 'dashboard';
        if (VALID_VIEWS.includes(view)) {
            setActiveView(view);
        }
    };

    window.addEventListener('popstate', handlePopState);

    // Initial load handling
    const initialHash = window.location.hash.replace('#', '');
    const initialView = VALID_VIEWS.find(v => v === initialHash) || 'dashboard';
    setActiveView(initialView);
    try {
      history.replaceState({ userView: initialView }, '', `#${initialView}`);
    } catch (e) {
      console.warn("Could not set initial history state:", e);
    }

    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, []);


  const handleViewChange = useCallback((view: UserViewType) => {
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
  }, [activeView, user.user_id]);
  
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'chat':
        return <FreeChat user={user} onUserUpdate={onUserUpdate} />;
      case 'algorithm_news':
        return <AlgorithmNews />;
      case 'story':
        return <StoryGenerator user={user} onUserUpdate={onUserUpdate} />;
      case 'post_scenario':
        return <PostScenarios user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
      case 'plans':
        return <UpcomingPlans user={user} onUserUpdate={onUserUpdate} />;
      case 'reports':
        return <Reports user={user} onUserUpdate={onUserUpdate} />;
      case 'image_video':
        return <ImageGenerator user={user} onUserUpdate={onUserUpdate} />;
      case 'caption':
        return <Captions user={user} />;
      case 'post_idea':
        return <PostIdea user={user} setActiveView={handleViewChange} />;
      default:
        return <UserDashboard user={user} setActiveView={handleViewChange} onUserUpdate={onUserUpdate} />;
    }
  };

  const NavItem: React.FC<{ view: UserViewType; icon: React.ComponentProps<typeof Icon>['name']; label: string }> = ({ view, icon, label }) => (
    <li>
      <button
        onClick={() => handleViewChange(view)}
        title={label}
        className={`flex items-center w-full p-3 rounded-lg transition-colors duration-200 text-right ${
          activeView === view ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
        } ${!isSidebarOpen && 'justify-center'}`}
      >
        <Icon name={icon} className="w-6 h-6 flex-shrink-0" />
        <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${isSidebarOpen ? "w-auto opacity-100 ms-4" : "w-0 opacity-0 ms-0"}`}>{label}</span>
      </button>
    </li>
  );

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
              <h1 className="text-lg font-bold text-white">سوپر ادمین آیتـــم</h1>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside ref={sidebarRef} className={`fixed lg:relative top-20 bottom-0 lg:top-auto lg:h-full flex-shrink-0 bg-slate-950 flex flex-col transition-all duration-300 ease-in-out z-30 ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'}`}>
          <div className="flex-grow overflow-y-auto">
            <nav className="p-4 mt-4">
              <ul className="space-y-2">
                  <NavItem view="dashboard" icon="dashboard" label="داشبورد" />
                  <NavItem view="chat" icon="chat" label="گفتگو با هوش مصنوعی" />
                  <NavItem view="post_scenario" icon="document-text" label="سناریوهای پست" />
                  <NavItem view="story" icon="scenario" label="سناریو استوری" />
                  <NavItem view="caption" icon="caption" label="کپشن‌ها" />
                  <NavItem view="plans" icon="plan" label="برنامه‌ها" />
                  <NavItem view="post_idea" icon="idea" label="ارسال ایده" />
                  <NavItem view="image_video" icon="image" label="تولید عکس" />
                  <NavItem view="algorithm_news" icon="broadcast" label="اخبار الگوریتم" />
                  <NavItem view="reports" icon="report" label="گزارشات" />
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
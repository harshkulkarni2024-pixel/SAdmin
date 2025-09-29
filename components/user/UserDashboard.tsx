import React, { useState, useEffect, useCallback } from 'react';
import { User, BroadcastMessage, PostScenario } from '../../types';
import { Icon } from '../common/Icon';
import { UserViewType } from './UserView';
import * as db from '../../services/dbService';

interface UserDashboardProps {
  user: User;
  setActiveView: (view: UserViewType) => void;
  onUserUpdate: () => void;
}

interface NewsItem {
    id: string;
    type: string;
    content: string;
    date: string;
}

const NEWS_NAVIGATION_MAP: Record<string, UserViewType> = {
  'برنامه جدید': 'plans',
  'گزارش جدید': 'reports',
  'سناریوی جدید': 'post_scenario',
};

const DashboardCard: React.FC<{
  title: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onClick: () => void;
  count?: number;
}> = ({ title, icon, onClick, count = 0 }) => (
  <button
    onClick={onClick}
    className="relative bg-slate-800 p-2 rounded-xl flex flex-col items-center justify-center text-center group hover:bg-violet-600 transition-all duration-300 transform hover:-translate-y-1"
  >
    {count > 0 && (
        <span className="absolute bottom-1.5 left-1.5 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
            {count}
        </span>
    )}
    <div className="bg-slate-700 p-1.5 rounded-full mb-1.5 group-hover:bg-white/10 transition-colors">
        <Icon name={icon} className="w-5 h-5 text-violet-400 group-hover:text-white transition-colors" />
    </div>
    <h3 className="text-xs font-semibold text-white">{title}</h3>
  </button>
);


const UserDashboard: React.FC<UserDashboardProps> = ({ user, setActiveView, onUserUpdate }) => {
  const [latestBroadcast, setLatestBroadcast] = useState<BroadcastMessage | null>(null);
  const [isBroadcastVisible, setIsBroadcastVisible] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [dismissedNews, setDismissedNews] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`dismissedNews_${user.user_id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notificationCounts, setNotificationCounts] = useState({scenarios: 0, plans: 0, reports: 0});

  const refreshDashboard = useCallback(async () => {
    // This function will re-evaluate all news and notifications.
    const allNews: NewsItem[] = [];
    
    // Broadcast
    // FIX: Await the promise to resolve before accessing its properties
    const broadcast = await db.getLatestBroadcast();
    if (broadcast) {
        allNews.push({id: `broadcast_${broadcast.id}`, type: 'اطلاعیه جدید', content: broadcast.message, date: broadcast.timestamp});
    }

    // Plan
    // FIX: Await the promise to resolve before accessing its properties
    const plan = await db.getPlanForUser(user.user_id);
    if (plan) {
        allNews.push({id: `plan_${plan.id}`, type: 'برنامه جدید', content: 'یک برنامه محتوایی جدید برای شما تنظیم شده است.', date: plan.timestamp});
    }

    // Report
    // FIX: Await the promise to resolve before using array methods
    const reports = await db.getReportsForUser(user.user_id);
    if (reports.length > 0) {
        // Create a single news item for all new reports
        const lastReportViewTime = Number(localStorage.getItem(`lastView_reports_${user.user_id}`) || 0);
        // FIX: The `reports` variable is now a resolved array, so .filter can be used
        const newReports = reports.filter(r => new Date(r.timestamp).getTime() > lastReportViewTime);
        if (newReports.length > 0) {
            allNews.push({id: `report_${newReports[0].id}`, type: 'گزارش جدید', content: `شما ${newReports.length} گزارش عملکرد جدید دارید.`, date: newReports[0].timestamp});
        }
    }
    
    // Scenarios
    // FIX: Await the promise to resolve into an array before using it
    const scenarios: PostScenario[] = await db.getScenariosForUser(user.user_id);
    if (scenarios.length > 0) {
        const latestScenario = scenarios.sort((a,b) => b.id - a.id)[0];
        allNews.push({id: `scenarios_${latestScenario.id}`, type: `سناریوی جدید`, content: `شما ${scenarios.length} سناریوی پست جدید دارید.`, date: new Date(latestScenario.id).toISOString() });
    }
    
    // We need to read the latest `dismissedNews` from local storage inside this callback,
    // or get it from state. Getting it from state is better.
    const currentDismissed = JSON.parse(localStorage.getItem(`dismissedNews_${user.user_id}`) || '[]');
    const filteredNews = allNews.filter(item => !currentDismissed.includes(item.id));
    
    filteredNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setNewsItems(filteredNews);
    // FIX: Await the promise to get notification counts
    const counts = await db.getNotificationCounts(user.user_id);
    setNotificationCounts(counts);
    onUserUpdate(); // Also refresh the main user object
  }, [user.user_id, onUserUpdate]);

  useEffect(() => {
    // FIX: Wrap async logic in an async function
    const initialize = async () => {
        // FIX: Await the promise to get the latest broadcast
        const broadcast = await db.getLatestBroadcast();
        if (broadcast) {
          const dismissedId = sessionStorage.getItem('dismissedBroadcastId');
          // FIX: The `broadcast` variable is now a resolved object
          if (String(broadcast.id) !== dismissedId) {
            setLatestBroadcast(broadcast);
            setIsBroadcastVisible(true);
          }
        }
        refreshDashboard();
    };
    initialize();
  }, [user.user_id, refreshDashboard]);

  const dismissBroadcast = () => {
    setIsBroadcastVisible(false);
    if (latestBroadcast) {
      sessionStorage.setItem('dismissedBroadcastId', String(latestBroadcast.id));
    }
  };
  
  const handleNewsClick = (item: NewsItem) => {
    // Immediately filter the item from the current view
    setNewsItems(currentItems => currentItems.filter(i => i.id !== item.id));

    // Update the persisted list of dismissed items
    const newDismissed = [...dismissedNews, item.id];
    setDismissedNews(newDismissed);
    localStorage.setItem(`dismissedNews_${user.user_id}`, JSON.stringify(newDismissed));
    
    // Navigate if a mapping exists
    const view = NEWS_NAVIGATION_MAP[item.type];
    if (view) {
      setActiveView(view);
    }
  };


  return (
    <div className="animate-fade-in">
      {isBroadcastVisible && latestBroadcast && (
        <div className="relative bg-violet-900/50 border border-violet-700 text-violet-200 px-4 py-3 rounded-lg mb-8">
          <h4 className="font-bold mb-1 flex items-center"><Icon name="broadcast" className="w-5 h-5 me-2" /> اطلاعیه</h4>
          <p className="text-sm whitespace-pre-wrap">{latestBroadcast.message}</p>
          <button onClick={dismissBroadcast} className="absolute top-2 left-2 text-violet-300 hover:text-white p-1">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      
      <h1 className="text-3xl font-bold text-white mb-2">
         {user.full_name} <span className="text-slate-400 text-xl font-normal">با سوپر ادمین آیتم تو یک لیگ دیگست :)</span>
      </h1>
      <p className="text-sm text-slate-400 mb-8">
        برای شروع، یکی از ابزارهای زیر را انتخاب کن.
      </p>

      <div className="mb-6">
        <button
            onClick={() => setActiveView('chat')}
            className="w-full bg-slate-800 p-4 rounded-xl flex items-center justify-start text-center group hover:bg-violet-600 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700"
        >
            <div className="bg-slate-700 p-3 rounded-full me-4 group-hover:bg-white/10 transition-colors">
                <Icon name="chat" className="w-8 h-8 text-violet-400 group-hover:text-white transition-colors" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-white text-right">گفتگو با هوش مصنوعی سوپر ادمین آیتـــم</h3>
                <p className="text-sm text-slate-400 text-right">هرچیزی که در مورد استراتژی محتوا میخوای بدونی بپرس!</p>
            </div>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          <DashboardCard title="سناریو پست" icon="document-text" onClick={() => setActiveView('post_scenario')} count={notificationCounts.scenarios} />
          <DashboardCard title="سناریو استوری" icon="scenario" onClick={() => setActiveView('story')} />
          <DashboardCard title="کپشن‌ها" icon="caption" onClick={() => setActiveView('caption')} />
          <DashboardCard title="برنامه‌ها" icon="plan" onClick={() => setActiveView('plans')} count={notificationCounts.plans} />
          <DashboardCard title="ارسال ایده" icon="idea" onClick={() => setActiveView('post_idea')} />
          <DashboardCard title="تولید عکس" icon="image" onClick={() => setActiveView('image_video')} />
          <DashboardCard title="اخبار الگوریتم" icon="broadcast" onClick={() => setActiveView('algorithm_news')} />
          <DashboardCard title="گزارشات" icon="report" onClick={() => setActiveView('reports')} count={notificationCounts.reports} />
      </div>

      {newsItems.length > 0 && (
        <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">آخرین اخبار</h2>
            <div className="space-y-3">
                {newsItems.map((item) => {
                    const isClickable = !!NEWS_NAVIGATION_MAP[item.type] || item.type === 'اطلاعیه جدید';
                    return (
                        <div 
                            key={item.id}
                            onClick={() => isClickable && handleNewsClick(item)}
                            className={`bg-slate-800 p-4 rounded-lg border-l-4 border-violet-500 transition-colors ${isClickable ? 'hover:bg-slate-700/50 cursor-pointer' : ''}`}
                        >
                            <h3 className="font-bold text-violet-400">{item.type}</h3>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.content}</p>
                        </div>
                    )
                })}
            </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;

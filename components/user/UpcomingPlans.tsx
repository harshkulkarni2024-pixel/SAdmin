
import React, { useState, useEffect } from 'react';
import { Plan, ProductionEvent } from '../../types';
import { getPlansForUser, getProductionEventsForUser, clearUserNotifications } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { Loader } from '../common/Loader';

interface UpcomingPlansProps {
  // Props are handled by context
}

const formatTextForDisplay = (text: string): string => {
    if (!text) return '';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(urlPattern, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:underline break-all">${url}</a>`)
        .replace(/\n/g, '<br />');
};

type CombinedItem = 
  | { type: 'plan'; data: Plan; sortTime: number }
  | { type: 'event'; data: ProductionEvent; sortTime: number };

const UpcomingPlans: React.FC<UpcomingPlansProps> = () => {
  const { user } = useUser();
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [userPlans, userEvents] = await Promise.all([
                getPlansForUser(user.user_id),
                getProductionEventsForUser(user.full_name)
            ]);

            const combined: CombinedItem[] = [
                ...userPlans.map(p => ({ type: 'plan' as const, data: p, sortTime: new Date(p.timestamp).getTime() })),
                ...userEvents.map(e => ({ type: 'event' as const, data: e, sortTime: new Date(e.start_time).getTime() }))
            ];

            // Sort by date descending (newest first)
            combined.sort((a, b) => b.sortTime - a.sortTime);
            setItems(combined);
        } catch (e) {
            console.error("Error fetching plans:", e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
    clearUserNotifications('plans', user.user_id);
  }, [user]);

  if (isLoading) {
    return <div className="flex justify-center"><Loader /></div>;
  }
  
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-2">برنامه‌های پیش‌رو</h1>
      <p className="text-slate-400 mb-6">این نقشه راه محتوای آینده شماست که شامل برنامه‌ریزی‌ها و زمان‌های ضبط است.</p>

      {items.length > 0 ? (
        <div className="space-y-6">
          {items.map((item) => {
            if (item.type === 'event') {
                const event = item.data as ProductionEvent;
                return (
                    <div key={`event-${event.id}`} className="bg-gradient-to-r from-violet-900/40 to-slate-800 p-6 rounded-lg border border-violet-500/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                            <Icon name="video" className="w-3 h-3 inline-block mr-1"/>
                            زمان ضبط فیکس شده
                        </div>
                        <div className="mt-4 flex flex-col gap-2">
                            <h3 className="text-lg font-bold text-white">📅 {new Date(event.start_time).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                            <p className="text-violet-300 font-mono text-lg">
                                ⏰ {new Date(event.start_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} تا {new Date(event.end_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="mt-2 p-3 bg-slate-900/50 rounded-lg text-slate-300 text-sm">
                                <span className="font-bold text-violet-400">نوع برنامه:</span> {event.event_type === 'post' ? 'ضبط پست' : event.event_type === 'story' ? 'ضبط استوری' : 'جلسه'}
                                {event.description && <p className="mt-1 text-slate-400">{event.description}</p>}
                            </div>
                        </div>
                    </div>
                )
            } else {
                const plan = item.data as Plan;
                return (
                    <div key={`plan-${plan.id}`} className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400 mb-3 border-b border-slate-700 pb-2">
                        تاریخ ثبت: {new Date(plan.timestamp).toLocaleDateString('fa-IR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                        })}
                    </div>
                    <div className="text-slate-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatTextForDisplay(plan.content) }} />
                    </div>
                )
            }
          })}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg">
            <div className="text-center py-8">
                <Icon name="plan" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400">هنوز هیچ برنامه‌ای برای شما تنظیم نشده است.</p>
                <p className="text-sm text-slate-500">مدیر شما به زودی برنامه‌های جدید را اینجا اضافه خواهد کرد!</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default UpcomingPlans;

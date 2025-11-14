import React, { useState, useEffect } from 'react';
import { Plan } from '../../types';
import { getPlansForUser, clearUserNotifications } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { Loader } from '../common/Loader';

interface UpcomingPlansProps {
  // Props are handled by context
}

const formatTextForDisplay = (text: string): string => {
    if (!text) return '';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    // The AI might use markdown for bolding. Let's handle that too for consistency.
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(urlPattern, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:underline break-all">${url}</a>`)
        .replace(/\n/g, '<br />');
};

const UpcomingPlans: React.FC<UpcomingPlansProps> = () => {
  const { user } = useUser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPlans = async () => {
        setIsLoading(true);
        const userPlans = await getPlansForUser(user.user_id);
        setPlans(userPlans);
        setIsLoading(false);
    };
    fetchPlans();
    clearUserNotifications('plans', user.user_id);
  }, [user]);

  if (isLoading) {
    return <div className="flex justify-center"><Loader /></div>;
  }
  
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-2">برنامه‌های پیش‌رو</h1>
      <p className="text-slate-400 mb-6">این نقشه راه محتوای آینده شماست که توسط مدیر تنظیم شده.</p>

      {plans.length > 0 ? (
        <div className="space-y-6">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="text-sm text-slate-400 mb-3 border-b border-slate-700 pb-2">
                تاریخ ثبت: {new Date(plan.timestamp).toLocaleDateString('fa-IR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="text-slate-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatTextForDisplay(plan.content) }} />
            </div>
          ))}
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
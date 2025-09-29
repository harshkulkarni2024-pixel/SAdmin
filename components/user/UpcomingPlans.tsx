
import React, { useState, useEffect } from 'react';
import { User, Plan } from '../../types';
import { getPlanForUser, clearUserNotifications } from '../../services/dbService';
import { Icon } from '../common/Icon';

interface UpcomingPlansProps {
  user: User;
  onUserUpdate: () => void;
}

const UpcomingPlans: React.FC<UpcomingPlansProps> = ({ user, onUserUpdate }) => {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    // FIX: Wrap async logic in an async function to be called in useEffect
    const fetchPlan = async () => {
        // FIX: Await the async call to get the user's plan
        const userPlan = await getPlanForUser(user.user_id);
        setPlan(userPlan);
    };
    fetchPlan();
    clearUserNotifications('plans', user.user_id);
    onUserUpdate(); // Let parent know to refresh notification counts
  }, [user.user_id, onUserUpdate]);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-2">برنامه‌های پیش‌رو</h1>
      <p className="text-slate-400 mb-6">این نقشه راه محتوای آینده شماست که توسط مدیر تنظیم شده.</p>

      <div className="bg-slate-800 p-6 rounded-lg">
        {plan && plan.content ? (
          <p className="text-slate-300 whitespace-pre-wrap">{plan.content}</p>
        ) : (
          <div className="text-center py-8">
            <Icon name="plan" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">هنوز هیچ برنامه‌ای برای شما تنظیم نشده است.</p>
            <p className="text-sm text-slate-500">مدیر شما به زودی برنامه‌های جدید را اینجا اضافه خواهد کرد!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingPlans;

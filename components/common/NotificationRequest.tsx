
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';

const NotificationRequest: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPrompt(true);
    }
  }, []);

  const handleAllow = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('آیتــم', {
          body: 'نوتیفیکیشن‌ها با موفقیت فعال شدند. از این پس اخبار مهم را دریافت خواهید کرد.',
          icon: '/logo-192.png'
        });
      }
    } catch (e) {
      console.error("Error requesting permission", e);
    } finally {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[100] max-w-sm w-full animate-slide-up">
      <div className="bg-slate-800 border border-violet-500 rounded-lg shadow-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-violet-600/20 p-2 rounded-full">
            <Icon name="bell" className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">دریافت اعلان‌ها</h4>
            <p className="text-xs text-slate-300 mt-1">آیا می‌خواهید از اخبار، پیام‌ها و رویدادهای جدید باخبر شوید؟</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button 
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            بعداً
          </button>
          <button 
            onClick={handleAllow}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-md transition-colors shadow-lg shadow-violet-900/20"
          >
            بله، فعال کن
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationRequest;

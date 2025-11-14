import React, { useState, useEffect } from 'react';
import { Report } from '../../types';
import { getReportsForUser, clearUserNotifications } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { Loader } from '../common/Loader';

interface ReportsProps {
  // Props are handled by context
}

const STAT_ITEMS = [
    { key: 'delivered', label: 'تحویل داده شده', color: 'bg-green-500' },
    { key: 'uploaded', label: 'بارگذاری شده', color: 'bg-sky-500' },
    { key: 'editing', label: 'در حال تدوین', color: 'bg-yellow-500' },
    { key: 'pending', label: 'در انتظار بارگذاری', color: 'bg-red-500' },
];

const parseReportContent = (content: string) => {
    const delivered = parseInt(content.match(/تعداد کل ویدیو های تحویل داده شده:\s*(\d+)/)?.[1] || '0', 10);
    const uploaded = parseInt(content.match(/تعداد ویدیو بارگذاری شده:\s*(\d+)/)?.[1] || '0', 10);
    const pending = parseInt(content.match(/تعداد ویدیو در انتظار بارگزاری:\s*(\d+)/)?.[1] || '0', 10);
    const editing = parseInt(content.match(/تعداد ویدیو های در حال تدوین:\s*(\d+)/)?.[1] || '0', 10);
    return { delivered, uploaded, pending, editing };
};


const Reports: React.FC<ReportsProps> = () => {
  const { user } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchReports = async () => {
        setIsLoading(true);
        const userReports = await getReportsForUser(user.user_id);
        setReports(userReports);
        setIsLoading(false);
    };
    fetchReports();
    clearUserNotifications('reports', user.user_id);
  }, [user]);
  
  if (isLoading) {
    return <div className="flex justify-center"><Loader /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-2">گزارشات شما</h1>
      <p className="text-slate-400 mb-6">آخرین گزارش‌های مربوط به عملکرد محتوای خود را بررسی کنید.</p>

      {reports.length > 0 ? (
        <div className="space-y-6">
          {reports.map((report) => {
             const stats = parseReportContent(report.content);
             const total = stats.delivered + stats.uploaded + stats.pending + stats.editing;
             const maxStat = Math.max(1, total);
            return (
              <div key={report.id} className="bg-slate-800 p-6 rounded-lg">
                <div className="text-sm text-slate-400 mb-4 border-b border-slate-700 pb-3">
                  تاریخ ثبت: {new Date(report.timestamp).toLocaleDateString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>

                <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-200 mb-3">نمودار آمار</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
                        {STAT_ITEMS.map(item => (
                            <div key={item.key} className="flex items-center gap-2 text-xs">
                                <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
                                <span className="text-slate-300">{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="w-full bg-slate-900/50 rounded-full h-6 flex overflow-hidden">
                        {STAT_ITEMS.map(item => {
                           const value = stats[item.key as keyof typeof stats];
                           if (value === 0) return null;
                           const percentage = (value / maxStat) * 100;
                           return (
                               <div
                                   key={item.key}
                                   className={`h-full ${item.color} transition-all duration-500 flex items-center justify-center text-white text-xs font-bold`}
                                   style={{ width: `${percentage}%` }}
                                   title={`${item.label}: ${value}`}
                               >
                                  {value}
                               </div>
                           )
                        })}
                    </div>
                </div>

                <p className="text-slate-300 whitespace-pre-wrap pt-4 border-t border-slate-700">{report.content}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg">
          <div className="text-center py-8">
            <Icon name="report" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">هنوز گزارشی برای شما موجود نیست.</p>
            <p className="text-sm text-slate-500">برای مشاهده تحلیل عملکرد خود بعداً مراجعه کنید.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
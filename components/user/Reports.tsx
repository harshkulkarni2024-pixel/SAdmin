import React, { useState, useEffect } from 'react';
import { Report } from '../../types';
import { getReportsForUser, clearUserNotifications } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { Loader } from '../common/Loader';

interface ReportsProps {
  // Props are handled by context
}

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
          {reports.map((report) => (
            <div key={report.id} className="bg-slate-800 p-6 rounded-lg">
              <div className="text-sm text-slate-400 mb-3 border-b border-slate-700 pb-2">
                تاریخ ثبت: {new Date(report.timestamp).toLocaleDateString('fa-IR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <p className="text-slate-300 whitespace-pre-wrap">{report.content}</p>
            </div>
          ))}
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
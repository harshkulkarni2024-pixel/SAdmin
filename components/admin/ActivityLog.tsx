import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog as ActivityLogType, User } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';

type UserActivity = {
    user_id: number;
    user_full_name: string;
    count: number;
    logs: ActivityLogType[];
};

const ActivityLog: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLogType[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);

    useEffect(() => {
        // FIX: Wrap async logic in an async function to be called in useEffect
        const fetchLogs = async () => {
            // FIX: Await the async call to get activity logs
            const activityLogs = await db.getActivityLogs();
            setLogs(activityLogs);
        };
        fetchLogs();
        db.clearAdminNotifications('logs');
    }, []);

    const userActivities = useMemo(() => {
        const activityMap: Record<number, UserActivity> = {};
        logs.forEach(log => {
            if (!activityMap[log.user_id]) {
                activityMap[log.user_id] = {
                    user_id: log.user_id,
                    user_full_name: log.user_full_name,
                    count: 0,
                    logs: []
                };
            }
            activityMap[log.user_id].count++;
            activityMap[log.user_id].logs.push(log);
        });
        return Object.values(activityMap).sort((a, b) => b.logs[0].id - a.logs[0].id); // Sort by most recent activity
    }, [logs]);

    const timeSince = (date: string): string => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " سال پیش";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " ماه پیش";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " روز پیش";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " ساعت پیش";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " دقیقه پیش";
        return "لحظاتی پیش";
    };
    
    if (selectedUser) {
        return (
             <div className="max-w-4xl mx-auto animate-fade-in">
                <button onClick={() => setSelectedUser(null)} className="flex items-center text-violet-400 hover:text-violet-300 mb-4">
                     <Icon name="back" className="w-5 h-5 me-2"/> بازگشت به لیست کاربران
                </button>
                <h1 className="text-3xl font-bold text-white mb-2">فعالیت‌های کاربر: {selectedUser.user_full_name}</h1>
                <p className="text-slate-400 mb-6">در اینجا آخرین ۱۰۰ فعالیت ثبت شده توسط این کاربر را مشاهده می‌کنید.</p>
                 <div className="bg-slate-800 rounded-lg shadow-lg">
                    <ul className="divide-y divide-slate-700">
                        {selectedUser.logs.map(log => (
                            <li key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-700/50">
                                <p className="text-white">{log.action}</p>
                                <span className="text-xs text-slate-400 flex-shrink-0">{timeSince(log.timestamp)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">آخرین فعالیت‌های کاربران</h1>
            <p className="text-slate-400 mb-6">در اینجا آخرین ۱۰۰ فعالیت ثبت شده توسط کاربران را مشاهده می‌کنید.</p>

            {userActivities.length === 0 ? (
                <div className="text-center bg-slate-800 p-8 rounded-lg">
                    <Icon name="document-text" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
                    <p className="text-slate-300">هنوز هیچ فعالیتی ثبت نشده است.</p>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-lg shadow-lg">
                     <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-700 text-right">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">کاربر</th>
                            <th scope="col" className="px-6 py-3 text-xs font-medium text-slate-300 uppercase tracking-wider">تعداد فعالیت‌ها</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">مشاهده</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                           {userActivities.map(userActivity => (
                            <tr key={userActivity.user_id} className="hover:bg-slate-700/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{userActivity.user_full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{userActivity.count}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                <button onClick={() => setSelectedUser(userActivity)} className="text-violet-400 hover:text-violet-300">مشاهده جزئیات</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLog;

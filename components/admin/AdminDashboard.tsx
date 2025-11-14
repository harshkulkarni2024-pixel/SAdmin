import React, { useState, useEffect, useMemo } from 'react';
import { User, PostScenario, Report } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { AdminViewType } from './AdminView';

interface ReportStats {
    delivered: number;
    uploaded: number;
    pending: number;
    editing: number;
}

interface VideoStatsPerUser {
    userId: number;
    userName: string;
    stats: ReportStats;
}

interface ScenarioStat {
    userId: number;
    userName: string;
    count: number;
}

// Fix: Define the props interface for the component.
interface AdminDashboardProps {
    onNavigate: (view: AdminViewType) => void;
}

const STAT_ITEMS = [
    { key: 'delivered', label: 'تحویل داده شده', color: 'bg-green-500' },
    { key: 'uploaded', label: 'بارگذاری شده', color: 'bg-sky-500' },
    { key: 'editing', label: 'در حال تدوین', color: 'bg-yellow-500' },
    { key: 'pending', label: 'در انتظار بارگذاری', color: 'bg-red-500' },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [videoStats, setVideoStats] = useState<VideoStatsPerUser[]>([]);
    const [scenarioStats, setScenarioStats] = useState<ScenarioStat[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [users, scenarios, reports] = await Promise.all([
                    db.getAllUsers(),
                    db.getAllScenarios(),
                    db.getAllReports()
                ]);

                const userMap = new Map(users.map(u => [u.user_id, u.full_name]));

                // Process Report Stats per user
                const userLatestReports: { [key: number]: Report } = {};
                for (const report of reports) {
                    if (!userLatestReports[report.user_id] || new Date(report.timestamp) > new Date(userLatestReports[report.user_id].timestamp)) {
                        userLatestReports[report.user_id] = report;
                    }
                }

                const videoStatsData = users.map(user => {
                    const latestReport = userLatestReports[user.user_id];
                    const stats: ReportStats = { delivered: 0, uploaded: 0, pending: 0, editing: 0 };
                    if (latestReport) {
                        stats.delivered = parseInt(latestReport.content.match(/تعداد کل ویدیو های تحویل داده شده:\s*(\d+)/)?.[1] || '0', 10);
                        stats.uploaded = parseInt(latestReport.content.match(/تعداد ویدیو بارگذاری شده:\s*(\d+)/)?.[1] || '0', 10);
                        stats.pending = parseInt(latestReport.content.match(/تعداد ویدیو در انتظار بارگزاری:\s*(\d+)/)?.[1] || '0', 10);
                        stats.editing = parseInt(latestReport.content.match(/تعداد ویدیو های در حال تدوین:\s*(\d+)/)?.[1] || '0', 10);
                    }
                    return { userId: user.user_id, userName: user.full_name, stats };
                });
                
                const sortedVideoStatsData = videoStatsData.sort((a, b) => {
                    const aIsEmpty = a.stats.delivered === 0 && a.stats.uploaded === 0 && a.stats.pending === 0 && a.stats.editing === 0;
                    const bIsEmpty = b.stats.delivered === 0 && b.stats.uploaded === 0 && b.stats.pending === 0 && b.stats.editing === 0;

                    if (aIsEmpty && !bIsEmpty) return 1; // a goes to bottom
                    if (!aIsEmpty && bIsEmpty) return -1; // b goes to bottom
                    if (aIsEmpty && bIsEmpty) return 0; // both are empty, order doesn't matter

                    // If both have stats, sort by pending uploads ascending
                    return a.stats.pending - b.stats.pending;
                });
                
                setVideoStats(sortedVideoStatsData);

                // Process Scenario Stats
                const scenarioCounts: { [key: number]: number } = {};
                scenarios.forEach(scenario => {
                    scenarioCounts[scenario.user_id] = (scenarioCounts[scenario.user_id] || 0) + 1;
                });

                const scenarioStatsData = Object.entries(scenarioCounts)
                    .map(([userId, count]) => ({
                        userId: Number(userId),
                        userName: userMap.get(Number(userId)) || `کاربر ${userId}`,
                        count
                    }))
                    .sort((a, b) => b.count - a.count);
                setScenarioStats(scenarioStatsData);

            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const maxScenarioCount = useMemo(() => Math.max(1, ...scenarioStats.map(s => s.count)), [scenarioStats]);


    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader /></div>;
    }

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">داشبورد مدیریت</h1>
                <p className="text-slate-400 mt-1">آمار کلی و وضعیت کاربران در یک نگاه.</p>
            </div>

            <button onClick={() => onNavigate('users')} className="w-full bg-violet-600 p-4 rounded-xl flex items-center text-right group hover:bg-violet-700 transition-all duration-300 transform hover:-translate-y-1">
                <div className="bg-white/10 p-3 rounded-full me-4">
                    <Icon name="users" className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">مدیریت کاربران</h3>
                    <p className="text-sm text-violet-200">مشاهده، افزودن یا ویرایش اطلاعات کاربران</p>
                </div>
            </button>
            
            <div className="bg-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4">سناریو در انتظار ضبط</h2>
                {scenarioStats.length > 0 ? (
                     <div className="space-y-3">
                        {scenarioStats.map(stat => (
                            <div key={stat.userId} className="group">
                                <div className="flex justify-between items-center mb-1 text-sm">
                                    <span className="text-slate-300">{stat.userName}</span>
                                    <span className="font-semibold text-white">{stat.count}</span>
                                </div>
                                <div className="w-full bg-slate-900/50 rounded-full h-2.5">
                                    <div 
                                        className="bg-violet-600 h-2.5 rounded-full group-hover:bg-violet-500 transition-all duration-300" 
                                        style={{ width: `${(stat.count / maxScenarioCount) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Icon name="scenario" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
                        <p className="text-slate-400">هیچ سناریوی ضبط نشده‌ای برای کاربران یافت نشد.</p>
                    </div>
                )}
            </div>

            <div className="bg-slate-800 p-6 rounded-xl">
                 <h2 className="text-xl font-bold text-white mb-4">آمار محتوا</h2>
                 <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                     {STAT_ITEMS.map(item => (
                         <div key={item.key} className="flex items-center gap-2 text-xs">
                             <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
                             <span className="text-slate-300">{item.label}</span>
                         </div>
                     ))}
                 </div>
                 <div className="space-y-4">
                     {videoStats.map(userStat => {
                        const stats = userStat.stats;
                        const total = stats.delivered + stats.uploaded + stats.pending + stats.editing;
                        const maxStat = Math.max(1, total);
                        
                        return (
                         <div key={userStat.userId}>
                             <p className="text-sm font-semibold text-slate-200 mb-1">{userStat.userName}</p>
                             <div className="w-full bg-slate-900/50 rounded-full h-6 flex overflow-hidden">
                                 {STAT_ITEMS.map(item => {
                                    const value = userStat.stats[item.key as keyof ReportStats];
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
                     )})}
                 </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
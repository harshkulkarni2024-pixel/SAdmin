
import React, { useState, useEffect, useMemo } from 'react';
import { User, PostScenario, Report, EditorTask, ActivityLog } from '../../types';
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

interface EditorStat {
    id: number;
    name: string;
    active: number;
    delivered: number;
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
    const [editorStats, setEditorStats] = useState<EditorStat[]>([]);
    const [editorLogs, setEditorLogs] = useState<ActivityLog[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [users, scenarios, reports, editorTasks, editors, editorActivity] = await Promise.all([
                    db.getAllUsers(),
                    db.getAllScenarios(),
                    db.getAllReports(),
                    db.getEditorTasks(),
                    db.getAllEditors(),
                    db.getEditorActivityLogs()
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

                // Process Editor Stats
                const editorMap: Record<number, {active: number, delivered: number}> = {};
                editors.forEach(ed => editorMap[ed.user_id] = {active: 0, delivered: 0});
                
                editorTasks.forEach(task => {
                    if (task.assigned_editor_id && editorMap[task.assigned_editor_id]) {
                        if (task.status === 'delivered') {
                            editorMap[task.assigned_editor_id].delivered++;
                        } else if (task.status === 'assigned' || task.status === 'issue_reported') {
                            editorMap[task.assigned_editor_id].active++;
                        }
                    }
                });

                const editorStatsData = editors.map(ed => ({
                    id: ed.user_id,
                    name: ed.full_name,
                    active: editorMap[ed.user_id]?.active || 0,
                    delivered: editorMap[ed.user_id]?.delivered || 0
                }));
                setEditorStats(editorStatsData);
                
                setEditorLogs(editorActivity);

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => onNavigate('editor_tasks')} className="w-full bg-violet-600 p-4 rounded-xl flex items-center text-right group hover:bg-violet-700 transition-all duration-300 transform hover:-translate-y-1">
                    <div className="bg-white/10 p-3 rounded-full me-4">
                        <Icon name="video" className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">مدیریت تدوین</h3>
                        <p className="text-sm text-violet-200">تخصیص و پیگیری پروژه‌های تدوین</p>
                    </div>
                </button>

                <button onClick={() => onNavigate('users')} className="w-full bg-slate-700 p-4 rounded-xl flex items-center text-right group hover:bg-slate-600 transition-all duration-300 transform hover:-translate-y-1">
                    <div className="bg-white/10 p-3 rounded-full me-4">
                        <Icon name="users" className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">مدیریت کاربران</h3>
                        <p className="text-sm text-slate-300">مشاهده و ویرایش اطلاعات کاربران</p>
                    </div>
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editors Performance Section */}
                <div className="bg-slate-800 p-6 rounded-xl">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Icon name="chart-bar" className="w-6 h-6 text-violet-400"/>
                        عملکرد تدوینگران
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm text-slate-300">
                            <thead className="text-slate-400 border-b border-slate-700">
                                <tr>
                                    <th className="pb-3 font-medium">نام تدوینگر</th>
                                    <th className="pb-3 font-medium text-center">در حال انجام</th>
                                    <th className="pb-3 font-medium text-center">تحویل شده</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {editorStats.map(ed => (
                                    <tr key={ed.id} className="hover:bg-slate-700/30">
                                        <td className="py-3">{ed.name}</td>
                                        <td className="py-3 text-center font-bold text-yellow-400">{ed.active}</td>
                                        <td className="py-3 text-center font-bold text-green-400">{ed.delivered}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Editor Activity Logs */}
                <div className="bg-slate-800 p-6 rounded-xl max-h-[400px] overflow-y-auto">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Icon name="document-text" className="w-6 h-6 text-blue-400"/>
                        آخرین فعالیت‌های تیم تدوین
                    </h2>
                    {editorLogs.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-4">فعالیتی ثبت نشده است.</p>
                    ) : (
                        <ul className="space-y-3">
                            {editorLogs.map(log => (
                                <li key={log.id} className="text-sm border-b border-slate-700 pb-2 last:border-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-200">{log.user_full_name}</span>
                                        <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleDateString('fa-IR')}</span>
                                    </div>
                                    <p className="text-slate-400">{log.action}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4">سناریو در انتظار ضبط (کاربران)</h2>
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
                 <h2 className="text-xl font-bold text-white mb-4">آمار کلی محتوا</h2>
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

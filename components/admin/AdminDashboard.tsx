import React, { useState, useEffect, useMemo } from 'react';
import { User, PostScenario, Report } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { AdminViewType } from './AdminView';

interface AdminDashboardProps {
  onNavigate: (view: AdminViewType) => void;
}

interface ReportStats {
    delivered: number;
    uploaded: number;
    pending: number;
    editing: number;
}

interface ScenarioStat {
    userId: number;
    userName: string;
    count: number;
}

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ComponentProps<typeof Icon>['name'] }> = ({ title, value, icon }) => (
    <div className="bg-slate-800 p-4 rounded-xl flex items-center">
        <div className="bg-slate-700 p-3 rounded-full me-4">
            <Icon name={icon} className="w-6 h-6 text-violet-400" />
        </div>
        <div>
            <h3 className="text-sm font-medium text-slate-400">{title}</h3>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [reportStats, setReportStats] = useState<ReportStats>({ delivered: 0, uploaded: 0, pending: 0, editing: 0 });
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

                // Process Report Stats
                const userLatestReports: { [key: number]: Report } = {};
                for (const report of reports) {
                    if (!userLatestReports[report.user_id]) {
                        userLatestReports[report.user_id] = report;
                    }
                }

                const totals: ReportStats = { delivered: 0, uploaded: 0, pending: 0, editing: 0 };
                Object.values(userLatestReports).forEach(report => {
                    totals.delivered += parseInt(report.content.match(/تعداد کل ویدیو های تحویل داده شده:\s*(\d+)/)?.[1] || '0', 10);
                    totals.uploaded += parseInt(report.content.match(/تعداد ویدیو بارگذاری شده:\s*(\d+)/)?.[1] || '0', 10);
                    totals.pending += parseInt(report.content.match(/تعداد ویدیو در انتظار بارگزاری:\s*(\d+)/)?.[1] || '0', 10);
                    totals.editing += parseInt(report.content.match(/تعداد ویدیو های در حال تدوین:\s*(\d+)/)?.[1] || '0', 10);
                });
                setReportStats(totals);

                // Process Scenario Stats
                const scenarioCounts: { [key: number]: number } = {};
                scenarios.forEach(scenario => {
                    scenarioCounts[scenario.user_id] = (scenarioCounts[scenario.user_id] || 0) + 1;
                });

                const userMap = new Map(users.map(u => [u.user_id, u.full_name]));
                const stats = Object.entries(scenarioCounts)
                    .map(([userId, count]) => ({
                        userId: Number(userId),
                        userName: userMap.get(Number(userId)) || `کاربر ${userId}`,
                        count
                    }))
                    .sort((a, b) => b.count - a.count);
                setScenarioStats(stats);

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <button onClick={() => onNavigate('users')} className="bg-violet-600 p-4 rounded-xl flex items-center text-right group hover:bg-violet-700 transition-all duration-300 transform hover:-translate-y-1 col-span-1 md:col-span-2 lg:col-span-4">
                    <div className="bg-white/10 p-3 rounded-full me-4">
                        <Icon name="users" className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">مدیریت کاربران</h3>
                        <p className="text-sm text-violet-200">مشاهده، افزودن یا ویرایش اطلاعات کاربران</p>
                    </div>
                </button>
                <StatCard title="ویدیوهای تحویل داده شده" value={reportStats.delivered} icon="check-circle" />
                <StatCard title="ویدیوهای بارگذاری شده" value={reportStats.uploaded} icon="upload" />
                <StatCard title="در انتظار بارگذاری" value={reportStats.pending} icon="document-text" />
                <StatCard title="در حال تدوین" value={reportStats.editing} icon="edit" />
            </div>

            <div className="bg-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4">سناریوهای ضبط نشده کاربران</h2>
                {scenarioStats.length > 0 ? (
                    <div className="w-full h-80 bg-slate-900/50 p-4 rounded-lg flex gap-4 items-end overflow-x-auto">
                        {scenarioStats.map(stat => (
                            <div key={stat.userId} className="flex flex-col items-center flex-shrink-0 group" style={{width: '60px'}}>
                                <div className="relative w-full h-full flex items-end">
                                    <div 
                                        className="w-full bg-violet-600 hover:bg-violet-500 rounded-t-md transition-all duration-300"
                                        style={{ height: `${(stat.count / maxScenarioCount) * 100}%` }}
                                    >
                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-white px-2 py-1 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                            {stat.count} سناریو
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2 text-center truncate w-full" title={stat.userName}>{stat.userName}</p>
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
        </div>
    );
};

export default AdminDashboard;

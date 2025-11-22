
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EditorTask, User } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

type ViewMode = 'kanban' | 'team' | 'profile';

const EditorTaskManagement: React.FC = () => {
    const showNotification = useNotification();
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [tasks, setTasks] = useState<EditorTask[]>([]);
    const [editors, setEditors] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // State for profile view
    const [selectedEditor, setSelectedEditor] = useState<User | null>(null);

    // Filter states for Kanban
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'delivered'>('pending');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [allTasks, allEditors] = await Promise.all([
                db.getEditorTasks(),
                db.getAllEditors()
            ]);
            setTasks(allTasks);
            setEditors(allEditors);
        } catch (error) {
            showNotification('خطا در بارگذاری اطلاعات.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAssign = async (taskId: number, editorId: string, note: string) => {
        if (!editorId) return;
        try {
            await db.assignEditorTask(taskId, parseInt(editorId), note);
            showNotification('تدوین با موفقیت به تدوینگر اختصاص یافت.', 'success');
            fetchData();
        } catch (error) {
            showNotification('خطا در اختصاص پروژه.', 'error');
        }
    };

    const handleViewProfile = (editor: User) => {
        setSelectedEditor(editor);
        setViewMode('profile');
    }

    // --- SUB-COMPONENTS ---

    // 1. TASK BOARD (KANBAN)
    const TaskBoardView = () => {
        const filteredTasks = tasks.filter(task => {
            if (filterStatus === 'all') return true;
            if (filterStatus === 'pending') return task.status === 'pending_assignment';
            if (filterStatus === 'active') return task.status === 'assigned' || task.status === 'issue_reported';
            if (filterStatus === 'delivered') return task.status === 'delivered';
            return true;
        });

        const TaskCard: React.FC<{ task: EditorTask }> = ({ task }) => {
            const [taskEditorId, setTaskEditorId] = useState(task.assigned_editor_id?.toString() || '');
            const [adminNote, setAdminNote] = useState(task.admin_note || '');
            const isAssigned = task.status !== 'pending_assignment';

            return (
                <div className={`p-4 rounded-lg border ${task.status === 'issue_reported' ? 'bg-red-900/20 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-white">سناریو شماره {task.scenario_number}</h3>
                            <p className="text-sm text-slate-400">کارفرما: {task.client_name}</p>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                            {new Date(task.created_at).toLocaleDateString('fa-IR')}
                        </div>
                    </div>
                    
                    <div className="mb-4 bg-slate-900/50 p-3 rounded text-sm text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {task.scenario_content}
                    </div>

                    {task.status === 'issue_reported' && (
                        <div className="mb-4 bg-red-900/50 p-3 rounded border border-red-700">
                            <p className="text-red-200 font-bold text-sm flex items-center gap-2">
                                <Icon name="exclamation-triangle" className="w-4 h-4"/>
                                گزارش مشکل از تدوینگر:
                            </p>
                            <p className="text-slate-300 text-sm mt-1">{task.editor_note}</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3 mt-4 border-t border-slate-700 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">انتخاب تدوینگر</label>
                                <select 
                                    value={taskEditorId} 
                                    onChange={(e) => setTaskEditorId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                                    disabled={isAssigned && task.status !== 'issue_reported'}
                                >
                                    <option value="">انتخاب کنید...</option>
                                    {editors.map(ed => (
                                        <option key={ed.user_id} value={ed.user_id}>{ed.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">یادداشت مدیر (اختیاری)</label>
                                <input 
                                    type="text" 
                                    value={adminNote} 
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="توضیحات برای تدوینگر..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleAssign(task.id, taskEditorId, adminNote)}
                            disabled={!taskEditorId}
                            className={`w-full py-2 rounded font-semibold transition-colors ${
                                isAssigned 
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                                : 'bg-violet-600 text-white hover:bg-violet-700'
                            }`}
                        >
                            {isAssigned ? 'بروزرسانی وضعیت / تدوینگر' : 'تایید و ارجاع به تدوینگر'}
                        </button>
                    </div>
                    
                    {task.status === 'delivered' && (
                        <div className="mt-3 text-center text-green-400 text-sm font-bold bg-green-900/20 p-2 rounded">
                            ✅ تحویل داده شده
                        </div>
                    )}
                </div>
            );
        };

        return (
            <>
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { key: 'pending', label: 'در انتظار تخصیص' },
                        { key: 'active', label: 'در حال انجام / دارای مشکل' },
                        { key: 'delivered', label: 'تحویل داده شده' },
                        { key: 'all', label: 'همه موارد' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key as any)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                                filterStatus === tab.key 
                                ? 'bg-violet-600 text-white' 
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {filteredTasks.length === 0 ? (
                    <div className="text-center py-10 bg-slate-800 rounded-lg">
                        <Icon name="video" className="w-12 h-12 mx-auto text-slate-500 mb-3"/>
                        <p className="text-slate-400">موردی یافت نشد.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredTasks.map(task => <TaskCard key={task.id} task={task} />)}
                    </div>
                )}
            </>
        );
    }

    // 2. TEAM MANAGEMENT
    const TeamManagementView = () => {
        const [newEditorName, setNewEditorName] = useState('');
        const [newEditorCode, setNewEditorCode] = useState('');
        const [showAddModal, setShowAddModal] = useState(false);

        const handleAddEditor = async () => {
            if (!newEditorName || !newEditorCode) return;
            const res = await db.addEditor(newEditorName, newEditorCode);
            showNotification(res.message, res.success ? 'success' : 'error');
            if (res.success) {
                setNewEditorName('');
                setNewEditorCode('');
                setShowAddModal(false);
                fetchData();
            }
        };

        const handleDeleteEditor = async (id: number) => {
            if(confirm('آیا مطمئن هستید؟ با حذف تدوینگر، تمام پروژه‌های اختصاص داده شده به او بی‌صاحب خواهند شد.')) {
                await db.deleteUser(id);
                showNotification('تدوینگر با موفقیت حذف شد.', 'success');
                fetchData();
            }
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">اعضای تیم تدوین</h2>
                    <button onClick={() => setShowAddModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Icon name="plus" className="w-5 h-5"/>
                        افزودن تدوینگر
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {editors.map(editor => {
                        // Calculate quick stats for card
                        const editorTasks = tasks.filter(t => t.assigned_editor_id === editor.user_id);
                        const activeCount = editorTasks.filter(t => t.status === 'assigned' || t.status === 'issue_reported').length;
                        const deliveredCount = editorTasks.filter(t => t.status === 'delivered').length;

                        return (
                            <div key={editor.user_id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-violet-500/50 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{editor.full_name}</h3>
                                        <p className="text-slate-400 text-sm font-mono mt-1">{editor.access_code}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleViewProfile(editor)} className="p-2 text-violet-400 hover:bg-violet-900/30 rounded-full" title="مشاهده عملکرد">
                                            <Icon name="chart-bar" className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDeleteEditor(editor.user_id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-full" title="حذف تدوینگر">
                                            <Icon name="trash" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <div className="bg-slate-900/50 p-2 rounded text-center">
                                        <p className="text-xs text-slate-400">در حال انجام</p>
                                        <p className="text-lg font-bold text-yellow-400">{activeCount}</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-2 rounded text-center">
                                        <p className="text-xs text-slate-400">تحویل شده</p>
                                        <p className="text-lg font-bold text-green-400">{deliveredCount}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {showAddModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full border border-slate-700">
                            <h3 className="text-xl font-bold text-white mb-4">افزودن تدوینگر جدید</h3>
                            <div className="space-y-4">
                                <input 
                                    type="text" 
                                    placeholder="نام و نام خانوادگی" 
                                    value={newEditorName} 
                                    onChange={e => setNewEditorName(e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white"
                                />
                                <input 
                                    type="text" 
                                    placeholder="کد دسترسی (انگلیسی)" 
                                    value={newEditorCode} 
                                    onChange={e => setNewEditorCode(e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono dir-ltr"
                                />
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-slate-600">انصراف</button>
                                    <button onClick={handleAddEditor} disabled={!newEditorName || !newEditorCode} className="flex-1 bg-violet-600 text-white py-2 rounded hover:bg-violet-700 disabled:opacity-50">افزودن</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 3. PROFILE PERFORMANCE VIEW
    const ProfilePerformanceView = () => {
        const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('all');
        
        if (!selectedEditor) return null;

        const editorTasks = tasks.filter(t => t.assigned_editor_id === selectedEditor.user_id);
        
        // Filter by time range
        const filteredHistory = editorTasks.filter(task => {
            if (timeRange === 'all') return true;
            const taskDate = new Date(task.updated_at);
            const now = new Date();
            const diffDays = (now.getTime() - taskDate.getTime()) / (1000 * 3600 * 24);
            return timeRange === 'week' ? diffDays <= 7 : diffDays <= 30;
        });

        // Calculate Stats
        const totalAssigned = filteredHistory.length;
        const delivered = filteredHistory.filter(t => t.status === 'delivered').length;
        const active = filteredHistory.filter(t => t.status === 'assigned').length;
        const issues = filteredHistory.filter(t => t.status === 'issue_reported').length;
        const completionRate = totalAssigned > 0 ? Math.round((delivered / totalAssigned) * 100) : 0;

        return (
            <div className="animate-fade-in">
                <button onClick={() => { setSelectedEditor(null); setViewMode('team'); }} className="flex items-center text-slate-400 hover:text-white mb-6">
                    <Icon name="back" className="w-5 h-5 me-2"/>
                    بازگشت به لیست تیم
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">{selectedEditor.full_name}</h2>
                        <p className="text-slate-400 mt-1 font-mono">کد دسترسی: {selectedEditor.access_code}</p>
                    </div>
                    <div className="bg-slate-800 p-1 rounded-lg inline-flex">
                        {[
                            { k: 'week', l: '۷ روز اخیر' }, 
                            { k: 'month', l: '۳۰ روز اخیر' }, 
                            { k: 'all', l: 'کل تاریخچه' }
                        ].map(opt => (
                            <button 
                                key={opt.k}
                                onClick={() => setTimeRange(opt.k as any)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === opt.k ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">تعداد کل پروژه‌ها</p>
                        <p className="text-2xl font-bold text-white">{totalAssigned}</p>
                    </div>
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">تحویل شده</p>
                        <p className="text-2xl font-bold text-green-400">{delivered}</p>
                    </div>
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">نرخ تکمیل</p>
                        <p className="text-2xl font-bold text-violet-400">{completionRate}%</p>
                    </div>
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">گزارش مشکل</p>
                        <p className="text-2xl font-bold text-red-400">{issues}</p>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                    <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                        <h3 className="font-bold text-white">تاریخچه فعالیت‌ها</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="text-slate-400 bg-slate-800/50 border-b border-slate-700">
                                <tr>
                                    <th className="p-4">پروژه</th>
                                    <th className="p-4">کارفرما</th>
                                    <th className="p-4">تاریخ ثبت</th>
                                    <th className="p-4">آخرین بروزرسانی</th>
                                    <th className="p-4">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700 text-slate-300">
                                {filteredHistory.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">هیچ فعالیتی در این بازه زمانی ثبت نشده است.</td></tr>
                                ) : (
                                    filteredHistory.map(task => (
                                        <tr key={task.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 font-medium">سناریو شماره {task.scenario_number}</td>
                                            <td className="p-4">{task.client_name}</td>
                                            <td className="p-4">{new Date(task.created_at).toLocaleDateString('fa-IR')}</td>
                                            <td className="p-4">{new Date(task.updated_at).toLocaleDateString('fa-IR')}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    task.status === 'delivered' ? 'bg-green-900/30 text-green-400' :
                                                    task.status === 'issue_reported' ? 'bg-red-900/30 text-red-400' :
                                                    'bg-yellow-900/30 text-yellow-400'
                                                }`}>
                                                    {task.status === 'delivered' ? 'تحویل شده' : 
                                                     task.status === 'issue_reported' ? 'دارای مشکل' : 'در حال انجام'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            {viewMode !== 'profile' && (
                <>
                    <h1 className="text-3xl font-bold text-white mb-6">مدیریت استودیوی تدوین</h1>
                    <div className="flex border-b border-slate-700 mb-6">
                        <button 
                            onClick={() => setViewMode('kanban')}
                            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${viewMode === 'kanban' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                        >
                            میز کار (پروژه‌ها)
                        </button>
                        <button 
                            onClick={() => setViewMode('team')}
                            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${viewMode === 'team' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                        >
                            مدیریت تیم و اعضا
                        </button>
                    </div>
                </>
            )}

            {viewMode === 'kanban' && <TaskBoardView />}
            {viewMode === 'team' && <TeamManagementView />}
            {viewMode === 'profile' && <ProfilePerformanceView />}
        </div>
    );
};

export default EditorTaskManagement;

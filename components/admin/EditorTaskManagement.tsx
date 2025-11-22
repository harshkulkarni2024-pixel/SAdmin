
import React, { useState, useEffect, useCallback } from 'react';
import { EditorTask, User } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

const EditorTaskManagement: React.FC = () => {
    const showNotification = useNotification();
    const [tasks, setTasks] = useState<EditorTask[]>([]);
    const [editors, setEditors] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filter states
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
            showNotification('تسک با موفقیت به تدوینگر اختصاص یافت.', 'success');
            fetchData();
        } catch (error) {
            showNotification('خطا در اختصاص تسک.', 'error');
        }
    };

    const filteredTasks = tasks.filter(task => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'pending') return task.status === 'pending_assignment';
        if (filterStatus === 'active') return task.status === 'assigned' || task.status === 'issue_reported';
        if (filterStatus === 'delivered') return task.status === 'delivered';
        return true;
    });

    const TaskCard: React.FC<{ task: EditorTask }> = ({ task }) => {
        const [selectedEditor, setSelectedEditor] = useState(task.assigned_editor_id?.toString() || '');
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
                                value={selectedEditor} 
                                onChange={(e) => setSelectedEditor(e.target.value)}
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
                        onClick={() => handleAssign(task.id, selectedEditor, adminNote)}
                        disabled={!selectedEditor}
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

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-6">مدیریت تسک‌های تدوین</h1>
            
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
        </div>
    );
};

export default EditorTaskManagement;

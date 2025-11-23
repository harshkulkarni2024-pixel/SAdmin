
import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { EditorTask } from '../../types';
import * as db from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

const formatTextForDisplay = (text: string): string => {
    if (!text) return '';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text
        .replace(urlPattern, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:underline break-all">${url}</a>`)
        .replace(/\n/g, '<br />');
};

const EditorView: React.FC = () => {
    const { user, logout } = useUser();
    const showNotification = useNotification();
    const [tasks, setTasks] = useState<EditorTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterProject, setFilterProject] = useState<string>('all');
    const [issueModalTask, setIssueModalTask] = useState<EditorTask | null>(null);
    const [issueText, setIssueText] = useState('');

    const fetchTasks = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const editorTasks = await db.getEditorTasks(user.user_id);
            setTasks(editorTasks);
        } catch (error) {
            console.error(error);
            showNotification('خطا در دریافت لیست پروژه‌ها', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, showNotification]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleStatusUpdate = async (taskId: number, status: EditorTask['status'], note?: string, scenarioNumber?: number) => {
        if (!user) return;
        try {
            await db.updateEditorTaskStatus(taskId, status, note);
            
            // LOG THE ACTIVITY
            let logMessage = '';
            if (status === 'delivered') {
                logMessage = `پروژه سناریو شماره ${scenarioNumber} را تحویل داد.`;
            } else if (status === 'issue_reported') {
                logMessage = `برای پروژه سناریو شماره ${scenarioNumber} گزارش مشکل ثبت کرد.`;
            }
            
            if (logMessage) {
                await db.logActivity(user.user_id, logMessage);
            }

            showNotification(status === 'delivered' ? 'پروژه با موفقیت تحویل داده شد.' : 'گزارش مشکل ثبت شد.', 'success');
            fetchTasks();
            setIssueModalTask(null);
            setIssueText('');
        } catch (error) {
            showNotification('خطا در بروزرسانی وضعیت.', 'error');
        }
    };

    const projects = Array.from(new Set(tasks.map(t => t.client_name || 'Unknown')));

    const filteredTasks = tasks.filter(task => {
        if (filterProject !== 'all' && task.client_name !== filterProject) return false;
        return true;
    });

    // Sort: Active tasks first, then delivered
    filteredTasks.sort((a, b) => {
        if (a.status === 'delivered' && b.status !== 'delivered') return 1;
        if (a.status !== 'delivered' && b.status === 'delivered') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    if (!user) return <Loader />;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
            <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-600 p-2 rounded-lg">
                        <Icon name="video" className="w-6 h-6 text-white"/>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">پنل تدوینگر</h1>
                        <p className="text-xs text-slate-400">{user.full_name}</p>
                    </div>
                </div>
                <button onClick={logout} className="text-slate-400 hover:text-red-400">
                    <Icon name="logout" className="w-6 h-6"/>
                </button>
            </header>

            <main className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold">لیست پروژه‌ها</h2>
                    <select 
                        value={filterProject} 
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white min-w-[200px]"
                    >
                        <option value="all">همه پروژه‌ها</option>
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center pt-20"><Loader /></div>
                ) : filteredTasks.length === 0 ? (
                    <div className="text-center pt-20 text-slate-500">
                        <p>هیچ پروژه تدوینی یافت نشد.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTasks.map(task => (
                            <div key={task.id} className={`relative bg-slate-800 rounded-xl overflow-hidden border ${task.status === 'delivered' ? 'border-green-900/50 opacity-75' : 'border-slate-700 shadow-lg'}`}>
                                {task.status === 'delivered' && (
                                    <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                                        تحویل داده شد
                                    </div>
                                )}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-white text-lg">سناریو {task.scenario_number}</h3>
                                            <p className="text-violet-400 text-sm">{task.client_name}</p>
                                        </div>
                                        <span className="text-xs text-slate-500">{new Date(task.created_at).toLocaleDateString('fa-IR')}</span>
                                    </div>

                                    <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-slate-300 mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap">
                                        {task.scenario_content}
                                    </div>

                                    {task.admin_note && (
                                        <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg mb-4">
                                            <p className="text-xs text-blue-300 font-bold mb-1">یادداشت مدیر:</p>
                                            <div className="text-xs text-slate-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatTextForDisplay(task.admin_note) }} />
                                        </div>
                                    )}

                                    {task.status !== 'delivered' && (
                                        <div className="flex gap-2 mt-4">
                                            <button 
                                                onClick={() => handleStatusUpdate(task.id, 'delivered', undefined, task.scenario_number)}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-1"
                                            >
                                                <Icon name="check-circle" className="w-4 h-4"/>
                                                تحویل
                                            </button>
                                            <button 
                                                onClick={() => setIssueModalTask(task)}
                                                className="flex-1 bg-slate-700 hover:bg-red-900/50 hover:text-red-200 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-1"
                                            >
                                                <Icon name="exclamation-triangle" className="w-4 h-4"/>
                                                گزارش مشکل
                                            </button>
                                        </div>
                                    )}
                                    {task.status === 'issue_reported' && (
                                        <div className="mt-2 text-center text-xs text-red-400">
                                            آخرین وضعیت: گزارش مشکل ارسال شده است.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Issue Modal */}
            {issueModalTask && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
                        <h3 className="text-xl font-bold text-white mb-4">گزارش مشکل در سناریو</h3>
                        <textarea
                            value={issueText}
                            onChange={(e) => setIssueText(e.target.value)}
                            placeholder="توضیحات مشکل را اینجا بنویسید..."
                            className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm mb-4 focus:border-violet-500 outline-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => { setIssueModalTask(null); setIssueText(''); }}
                                className="px-4 py-2 text-slate-400 hover:text-white"
                            >
                                انصراف
                            </button>
                            <button 
                                onClick={() => handleStatusUpdate(issueModalTask.id, 'issue_reported', issueText, issueModalTask.scenario_number)}
                                disabled={!issueText.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                            >
                                ثبت گزارش
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorView;


import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'approval' | 'delivered'>('pending');

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
    
    const handleApprove = async (taskId: number) => {
        if(!confirm('آیا از تایید نهایی و آرشیو این پروژه اطمینان دارید؟')) return;
        try {
            // Option A: Mark as delivered (archived)
            await db.updateEditorTaskStatus(taskId, 'delivered');
            // Option B: Delete the task if "Archiving" means removing from DB
            // await db.deleteEditorTask(taskId); 
            showNotification('پروژه تایید و به لیست تحویل شده‌ها منتقل شد.', 'success');
            fetchData();
        } catch (error) {
            showNotification('خطا در تایید پروژه.', 'error');
        }
    };

    const handleReject = async (taskId: number, note: string) => {
        if (!note) {
            showNotification('لطفاً دلیل عدم تایید را در بخش یادداشت بنویسید.', 'error');
            return;
        }
        try {
            await db.updateEditorTaskStatus(taskId, 'issue_reported', undefined); // Status back to issue/active
            // Ideally we should append the rejection note to admin_note or a new field, here using assign to update note
            // Assuming we can update just the note via a separate call or reusing assign logic without changing editor
            // For simplicity reusing assign with current editor
            const task = tasks.find(t => t.id === taskId);
            if (task && task.assigned_editor_id) {
                 await db.assignEditorTask(taskId, task.assigned_editor_id, `[عدم تایید]: ${note}`);
            }
            
            showNotification('پروژه عدم تایید شد و به تدوینگر برگشت.', 'info');
            fetchData();
        } catch (error) {
            showNotification('خطا در رد پروژه.', 'error');
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
            if (filterStatus === 'approval') return task.status === 'pending_approval';
            if (filterStatus === 'delivered') return task.status === 'delivered';
            return true;
        });

        const TaskCard: React.FC<{ task: EditorTask }> = ({ task }) => {
            const [taskEditorId, setTaskEditorId] = useState(task.assigned_editor_id ? String(task.assigned_editor_id) : '');
            const [adminNote, setAdminNote] = useState(task.admin_note || '');
            const [isRecording, setIsRecording] = useState(false);
            const [isUploading, setIsUploading] = useState(false);
            const fileInputRef = useRef<HTMLInputElement>(null);
            const mediaRecorderRef = useRef<MediaRecorder | null>(null);
            const isAssigned = task.status !== 'pending_assignment';

            useEffect(() => {
                setTaskEditorId(task.assigned_editor_id ? String(task.assigned_editor_id) : '');
            }, [task.assigned_editor_id]);

            useEffect(() => {
                setAdminNote(task.admin_note || '');
            }, [task.admin_note]);

            const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                setIsUploading(true);
                const url = await db.uploadFile(file);
                setIsUploading(false);
                
                if (url) {
                    setAdminNote(prev => prev + `\n[فایل پیوست: ${url}]`);
                    showNotification('فایل با موفقیت پیوست شد.', 'success');
                } else {
                    showNotification('خطا در آپلود فایل.', 'error');
                }
            };

            const startRecording = async () => {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    showNotification('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.', 'error');
                    return;
                }
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const recorder = new MediaRecorder(stream);
                    const chunks: Blob[] = [];
                    
                    recorder.ondataavailable = (e) => chunks.push(e.data);
                    recorder.onstop = async () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                        
                        setIsUploading(true);
                        const url = await db.uploadFile(file);
                        setIsUploading(false);
                        
                        if (url) {
                            setAdminNote(prev => prev + `\n[ویس: ${url}]`);
                            showNotification('ویس با موفقیت پیوست شد.', 'success');
                        } else {
                            showNotification('خطا در آپلود ویس.', 'error');
                        }
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    recorder.start();
                    mediaRecorderRef.current = recorder;
                    setIsRecording(true);
                } catch (err) {
                    console.error(err);
                    showNotification('عدم دسترسی به میکروفون.', 'error');
                }
            };

            const stopRecording = () => {
                if (mediaRecorderRef.current && isRecording) {
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                }
            };

            return (
                <div className={`p-4 rounded-lg border ${task.status === 'issue_reported' ? 'bg-red-900/20 border-red-500' : task.status === 'pending_approval' ? 'bg-green-900/20 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
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
                    
                    {task.status === 'pending_approval' && (
                        <div className="mb-4 bg-green-900/50 p-3 rounded border border-green-700 text-center">
                            <p className="text-green-200 font-bold text-sm">
                                ✅ تدوینگر کار را تحویل داده است.
                            </p>
                            <p className="text-xs text-slate-300 mt-1">لطفاً بررسی و تایید یا رد کنید.</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3 mt-4 border-t border-slate-700 pt-4">
                        {task.status !== 'pending_approval' && (
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-2">انتخاب تدوینگر</label>
                                    <div className="flex flex-wrap gap-2">
                                        {editors.map(ed => {
                                            const isSelected = taskEditorId === String(ed.user_id);
                                            return (
                                                <button
                                                    key={ed.user_id}
                                                    onClick={() => setTaskEditorId(String(ed.user_id))}
                                                    disabled={isAssigned && task.status !== 'issue_reported'}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                                        isSelected
                                                        ? 'bg-violet-600 border-violet-500 text-white shadow-md transform scale-105'
                                                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                                                    } ${isAssigned && task.status !== 'issue_reported' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {ed.full_name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">یادداشت مدیر (متن، فایل، ویس)</label>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            value={adminNote} 
                                            onChange={(e) => setAdminNote(e.target.value)}
                                            placeholder="توضیحات برای تدوینگر..."
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                                        />
                                        <button 
                                            onClick={() => fileInputRef.current?.click()} 
                                            disabled={isUploading}
                                            className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-slate-300" 
                                            title="پیوست فایل"
                                        >
                                            <Icon name="paperclip" className="w-5 h-5"/>
                                        </button>
                                        <button 
                                            onClick={isRecording ? stopRecording : startRecording}
                                            disabled={isUploading} 
                                            className={`p-2 rounded transition-colors ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                            title={isRecording ? 'توقف ضبط' : 'ضبط ویس'}
                                        >
                                            <Icon name="isRecording ? 'stop' : 'microphone'" className="w-5 h-5"/>
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>
                                    {isUploading && <span className="text-xs text-violet-400 animate-pulse">در حال آپلود...</span>}
                                </div>
                            </div>
                        )}
                        
                        {task.status === 'pending_approval' ? (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        value={adminNote} 
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        placeholder="علت عدم تایید (الزامی برای رد)"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white mb-2"
                                    />
                                    <button 
                                        onClick={() => handleReject(task.id, adminNote)}
                                        className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                    >
                                        عدم تایید و بازگشت
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleApprove(task.id)}
                                    className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold self-end h-[72px]"
                                >
                                    تایید نهایی (آرشیو)
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleAssign(task.id, taskEditorId, adminNote)}
                                disabled={(!taskEditorId || isUploading || isRecording) && task.status !== 'delivered'}
                                className={`w-full py-2 rounded font-semibold transition-colors ${
                                    isAssigned 
                                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                                    : 'bg-violet-600 text-white hover:bg-violet-700'
                                }`}
                            >
                                {isAssigned ? 'بروزرسانی وضعیت / تدوینگر' : 'تایید و ارجاع به تدوینگر'}
                            </button>
                        )}
                    </div>
                    
                    {task.status === 'delivered' && (
                        <div className="mt-3 text-center text-green-400 text-sm font-bold bg-green-900/20 p-2 rounded">
                            ✅ تحویل و آرشیو شده
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
                        { key: 'approval', label: 'در انتظار تایید' },
                        { key: 'delivered', label: 'آرشیو شده' },
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

    // 3. PROFILE PERFORMANCE VIEW (Same as before, just ensuring filtered logic works)
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
                                                     task.status === 'issue_reported' ? 'دارای مشکل' : 
                                                     task.status === 'pending_approval' ? 'منتظر تایید' : 'در حال انجام'}
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
                    <h1 className="text-3xl font-bold text-white mb-6">مدیریت تدوین</h1>
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
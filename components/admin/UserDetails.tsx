
import React, { useState, useEffect, useCallback } from 'react';
import { User, PostScenario, PostIdea, SubscriptionHistory, Plan, Report } from '../../types';
import * as db from '../../services/dbService';
import { generateCaption } from '../../services/geminiService';
import { Icon } from '../common/Icon';

interface UserDetailsProps {
    user: User;
    onBack: () => void;
    onUpdate: () => void; // To refresh admin notifications
}

type DetailTab = 'about' | 'subscription' | 'plans' | 'reports' | 'scenarios' | 'ideas' | 'limits';

const initialReportState = {
    delivered: '0',
    uploaded: '0',
    pending: '0',
    editing: '0',
    details: ''
};

const parseReportContent = (content: string) => {
    const delivered = content.match(/تعداد کل ویدیو های تحویل داده شده:\s*(\d+)/)?.[1] || '0';
    const uploaded = content.match(/تعداد ویدیو بارگذاری شده:\s*(\d+)/)?.[1] || '0';
    const pending = content.match(/تعداد ویدیو در انتظار بارگزاری:\s*(\d+)/)?.[1] || '0';
    const editing = content.match(/تعداد ویدیو های در حال تدوین:\s*(\d+)/)?.[1] || '0';
    const details = content.split('**توضیحات بیشتر:**')[1]?.trim() || '';
    return { delivered, uploaded, pending, editing, details };
};

const formatReportContent = (inputs: typeof initialReportState) => {
    return `- تعداد کل ویدیو های تحویل داده شده: ${inputs.delivered || 0}
- تعداد ویدیو بارگذاری شده: ${inputs.uploaded || 0}
- تعداد ویدیو در انتظار بارگزاری: ${inputs.pending || 0}
- تعداد ویدیو های در حال تدوین: ${inputs.editing || 0}

**توضیحات بیشتر:**
${inputs.details}`;
};


const UserDetails: React.FC<UserDetailsProps> = ({ user, onBack, onUpdate }) => {
    const [currentUser, setCurrentUser] = useState<User>(user);
    const [activeTab, setActiveTab] = useState<DetailTab>('about');
    
    // About Tab
    const [about, setAbout] = useState(user.about_info || '');
    const [preferredName, setPreferredName] = useState(user.preferred_name || '');
    const [accessCode, setAccessCode] = useState(user.access_code || ''); // Added access code state
    
    // Plans Tab
    const [plans, setPlans] = useState<Plan[]>([]);
    const [newPlanContent, setNewPlanContent] = useState('');

    // Reports Tab
    const [reports, setReports] = useState<Report[]>([]);
    const [reportInputs, setReportInputs] = useState(initialReportState);
    const [editingReport, setEditingReport] = useState<Report | null>(null);
    const [editingReportInputs, setEditingReportInputs] = useState(initialReportState);

    // Scenarios & Ideas
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [newScenario, setNewScenario] = useState({ number: '', content: '' });
    const [scenarioImage, setScenarioImage] = useState<string | null>(null);

    // Subscription
    const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
    const [extensionDays, setExtensionDays] = useState<string>('');
    
    // Limits
    const [usageLimits, setUsageLimits] = useState({
        story_requests: user.story_requests,
        caption_idea_requests: user.caption_idea_requests ?? 0,
        chat_messages: user.chat_messages,
    });
    const [totalLimits, setTotalLimits] = useState({
        story_limit: user.story_limit ?? 2,
        caption_idea_limit: user.caption_idea_limit ?? 5,
        chat_limit: user.chat_limit ?? 150,
    });

    // General
    const [notification, setNotification] = useState('');


    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(''), 4000);
    };

    const refreshData = useCallback(async (userToFetch: User) => {
        try {
            const freshUser = await db.getUserById(userToFetch.user_id);
            if (!freshUser) {
                onBack(); // User might have been deleted
                return;
            }
            setCurrentUser(freshUser);
            setAbout(freshUser.about_info || '');
            setPreferredName(freshUser.preferred_name || '');
            setAccessCode(freshUser.access_code || ''); // Update access code
            setPlans(await db.getPlansForUser(freshUser.user_id));
            setReports(await db.getReportsForUser(freshUser.user_id));
            setScenarios(await db.getScenariosForUser(freshUser.user_id));
            setIdeas(await db.getIdeasForUser(freshUser.user_id));
            setSubscriptionHistory(await db.getSubscriptionHistory(freshUser.user_id));

            setUsageLimits({
                story_requests: freshUser.story_requests,
                caption_idea_requests: freshUser.caption_idea_requests ?? 0,
                chat_messages: freshUser.chat_messages,
            });
            setTotalLimits({
                story_limit: freshUser.story_limit ?? 2,
                caption_idea_limit: freshUser.caption_idea_limit ?? 5,
                chat_limit: freshUser.chat_limit ?? 150,
            });
            
            onUpdate();
        } catch (e) {
            showNotification(`خطا در بارگذاری اطلاعات کاربر: ${(e as Error).message}`);
        }
    }, [onUpdate, onBack]);

    useEffect(() => {
        setCurrentUser(user);
        refreshData(user);
    }, [user, refreshData]);
    
    useEffect(() => {
        if(activeTab === 'ideas') {
            db.clearAdminNotifications('ideas');
            onUpdate();
        }
    }, [activeTab, onUpdate]);
    
    const handleSaveAbout = async () => {
        try {
            await db.updateUserInfo(user.user_id, { 
                about_info: about, 
                preferred_name: preferredName,
                access_code: accessCode 
            });
            showNotification('اطلاعات کاربر با موفقیت ذخیره شد.');
            refreshData(currentUser);
        } catch(e) {
            showNotification((e as Error).message);
        }
    };

    const handleDeleteUser = async () => {
        if (window.confirm('هشدار: آیا از حذف کامل این کاربر و تمام اطلاعات او مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
            try {
                await db.deleteUser(user.user_id);
                onBack(); // Go back to list immediately
            } catch (e) {
                showNotification(`خطا در حذف کاربر: ${(e as Error).message}`);
            }
        }
    };
    
    const handleSaveLimits = async () => {
        try {
            await Promise.all([
                db.updateUserUsageLimits(user.user_id, usageLimits),
                db.updateUserTotalLimits(user.user_id, totalLimits)
            ]);
            showNotification('محدودیت‌ها با موفقیت ذخیره شد.');
            refreshData(currentUser);
        } catch (error) {
            const err = error as Error;
            let friendlyMessage = `خطا در ذخیره محدودیت‌ها: ${err.message}`;
            if (err.message.includes("Could not find the column")) {
                friendlyMessage = `خطای پایگاه داده: یک یا چند ستون مورد نیاز برای محدودیت‌ها در جدول 'users' شما وجود ندارد. 
                
لطفاً راهنمای SQL در فایل services/dbService.ts را بررسی کرده و دستورات مربوط به افزودن ستون‌های 'caption_idea_requests' و 'caption_idea_limit' را اجرا کنید.`;
            }
            showNotification(friendlyMessage);
        }
    };

    // ... (Other handlers: handleExtendSubscription, calculateRemainingDays, handleAddPlan, etc. remain the same)
    const handleExtendSubscription = async () => {
        const days = parseInt(extensionDays, 10);
        if (isNaN(days) || days <= 0) {
            showNotification('لطفاً تعداد روز معتبری وارد کنید.');
            return;
        }

        const result = await db.extendSubscription(user.user_id, days);
        showNotification(result.message);
        if (result.success) {
            setExtensionDays('');
            refreshData(currentUser);
        }
    };

    const calculateRemainingDays = (expiryDate?: string): string => {
        if (!expiryDate) return 'تعریف نشده';
        const diff = new Date(expiryDate).getTime() - new Date().getTime();
        if (diff < 0) return 'منقضی شده';
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return `${days} روز`;
    };

    const handleAddPlan = async () => {
        if (!newPlanContent.trim()) return;
        try {
            await db.savePlanForUser(user.user_id, newPlanContent);
            setNewPlanContent('');
            await refreshData(currentUser);
            showNotification('برنامه جدید با موفقیت اضافه شد.');
        } catch (e) {
            showNotification(`خطا در افزودن برنامه: ${(e as Error).message}`);
        }
    };
    const handleDeletePlan = async (id: number) => {
        if (window.confirm('آیا از حذف این برنامه مطمئن هستید؟')) {
            try {
                await db.deletePlanById(id);
                await refreshData(currentUser);
            } catch (e) {
                showNotification(`خطا در حذف برنامه: ${(e as Error).message}`);
            }
        }
    };
    
    const handleAddReport = async () => {
        const content = formatReportContent(reportInputs);
        try {
            await db.saveReportForUser(user.user_id, content);
            setReportInputs(initialReportState);
            await refreshData(currentUser);
            showNotification('گزارش جدید با موفقیت اضافه شد.');
        } catch (e) {
            showNotification(`خطا در افزودن گزارش: ${(e as Error).message}`);
        }
    };
    
    const handleStartEditReport = (report: Report) => {
        setEditingReport(report);
        setEditingReportInputs(parseReportContent(report.content));
    };

    const handleSaveReportEdit = async () => {
        if (!editingReport) return;
        const content = formatReportContent(editingReportInputs);
        try {
            await db.updateReportById(editingReport.id, content);
            setEditingReport(null);
            await refreshData(currentUser);
            showNotification('گزارش با موفقیت ویرایش شد.');
        } catch (e) {
             showNotification(`خطا در ویرایش گزارش: ${(e as Error).message}`);
        }
    };

    const handleDeleteReport = async (id: number) => {
        if (window.confirm('آیا از حذف این گزارش مطمئن هستید؟')) {
            try {
                await db.deleteReportById(id);
                await refreshData(currentUser);
            } catch (e) {
                showNotification(`خطا در حذف گزارش: ${(e as Error).message}`);
            }
        }
    };
    
    const handleAddScenario = async () => {
        if (newScenario.number && newScenario.content) {
            await db.addScenarioForUser(user.user_id, parseInt(newScenario.number), newScenario.content);
            setNewScenario({ number: '', content: '' });
            setScenarioImage(null);
            refreshData(currentUser);
        }
    }
    
    const handleDeleteScenario = async (id: number) => {
        if (window.confirm('آیا مطمئن هستید؟ این سناریو تایید شده و برای تدوین ارسال خواهد شد (مشابه دکمه "ضبط کردم" کاربر).')) {
            const scenarioToDelete = scenarios.find(s => s.id === id);
            if (scenarioToDelete) {
                try {
                    try {
                        const captionContent = await generateCaption(user.about_info || '', scenarioToDelete.content);
                        if (captionContent && !captionContent.includes("Error") && captionContent.trim()) {
                             const captionTitle = `کپشن سناریو شماره ${scenarioToDelete.scenario_number}`;
                             await db.addCaption(user.user_id, captionTitle, captionContent, scenarioToDelete.content);
                        }
                    } catch (error) {
                        console.error("Caption generation failed during admin delete:", error);
                    } 
                    await db.createEditorTask(user.user_id, scenarioToDelete.content, scenarioToDelete.scenario_number);
                    await db.deleteScenario(id);
                    await db.logActivity(user.user_id, `سناریوی شماره ${scenarioToDelete.scenario_number} توسط مدیر تایید و به لیست تدوین اضافه شد.`);
                    
                    showNotification('سناریو برای تدوین ارسال شد.');
                    refreshData(currentUser);
                } catch (e) {
                     showNotification(`خطا در عملیات: ${(e as Error).message}`);
                }
            }
        }
    }
    
    const handleDeleteIdea = async (id: number) => {
        if (window.confirm('این ایده حذف شود؟')) {
            await db.deleteIdea(id);
            refreshData(currentUser);
        }
    }

    const handleScenarioImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScenarioImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };


    const renderTabContent = () => {
        switch (activeTab) {
            case 'about':
                return (
                     <div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">کد دسترسی (نام کاربری)</label>
                                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="w-full bg-slate-900 p-2 rounded text-violet-300 font-mono" placeholder="کد دسترسی" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">نام مورد خطاب (برای گفتگو)</label>
                                    <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="w-full bg-slate-900 p-2 rounded" placeholder="مثلا: مجتبی" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">درباره کاربر (برای سناریوها)</label>
                                <textarea value={about} onChange={(e) => setAbout(e.target.value)} className="w-full h-40 bg-slate-900 p-2 rounded" placeholder="اطلاعات کسب‌وکار کاربر، حوزه فعالیت و..."></textarea>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-between items-center border-t border-slate-700 pt-4">
                            <button onClick={handleDeleteUser} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-2 px-3 py-2 rounded hover:bg-red-900/20 transition-colors">
                                <Icon name="trash" className="w-4 h-4" />
                                حذف کامل کاربر
                            </button>
                            <button onClick={handleSaveAbout} className="bg-violet-600 px-6 py-2 rounded hover:bg-violet-700 text-white font-medium">ذخیره تغییرات</button>
                        </div>
                    </div>
                );
            case 'plans':
                 return (
                    <div>
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <h3 className="font-bold mb-2">افزودن برنامه جدید</h3>
                            <div className="relative">
                                <textarea value={newPlanContent} onChange={(e) => setNewPlanContent(e.target.value)} className="w-full h-32 bg-slate-700 p-2 rounded mb-2" placeholder="محتوای برنامه جدید را اینجا بنویسید..."></textarea>
                            </div>
                            <button onClick={handleAddPlan} disabled={!newPlanContent.trim()} className="bg-violet-600 px-4 py-2 rounded disabled:bg-slate-600">افزودن برنامه</button>
                        </div>
                        <div className="space-y-4">
                            {plans.length === 0 && <p className="text-slate-400">هنوز برنامه‌ای برای این کاربر ثبت نشده است.</p>}
                            {plans.map(item => (
                                <div key={item.id} className="bg-slate-700/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.content}</p>
                                        <button onClick={() => handleDeletePlan(item.id)} className="text-red-500 hover:text-red-400 p-1 flex-shrink-0"><Icon name="trash" className="w-5 h-5"/></button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 text-left">{new Date(item.timestamp).toLocaleString('fa-IR')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            // ... (Other cases like 'reports', 'subscription', 'scenarios', 'ideas', 'limits' remain exactly the same as previous file but are omitted here for brevity if allowed, otherwise I would paste them all. Assuming I need to return full file content)
            case 'reports':
                const ReportForm: React.FC<{ isEditing: boolean }> = ({ isEditing }) => {
                    const inputs = isEditing ? editingReportInputs : reportInputs;
                    const setInputs = isEditing ? setEditingReportInputs : setReportInputs;
                    const handleSubmit = isEditing ? handleSaveReportEdit : handleAddReport;
                    const handleCancel = () => setEditingReport(null);

                    return (
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <h3 className="font-bold mb-4">{isEditing ? 'ویرایش گزارش' : 'افزودن گزارش جدید'}</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { key: 'delivered', label: 'ویدیوهای تحویل داده شده' },
                                        { key: 'uploaded', label: 'ویدیوهای بارگذاری شده' },
                                        { key: 'pending', label: 'در انتظار بارگذاری' },
                                        { key: 'editing', label: 'در حال تدوین' },
                                    ].map(({ key, label }) => (
                                        <div key={key}>
                                            <label htmlFor={key} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                                            <input
                                                type="number"
                                                id={key}
                                                value={inputs[key as keyof typeof inputs]}
                                                onChange={(e) => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="w-full bg-slate-700 p-2 rounded text-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <label htmlFor="details" className="block text-sm font-medium text-slate-300 mb-1">توضیحات بیشتر</label>
                                    <textarea
                                        id="details"
                                        value={inputs.details}
                                        onChange={(e) => setInputs(prev => ({ ...prev, details: e.target.value }))}
                                        className="w-full h-24 bg-slate-700 p-2 rounded"
                                        placeholder="توضیحات تکمیلی گزارش..."
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <button onClick={handleSubmit} className="bg-violet-600 px-4 py-2 rounded hover:bg-violet-700">
                                    {isEditing ? 'ذخیره تغییرات' : 'افزودن گزارش'}
                                </button>
                                {isEditing && (
                                    <button onClick={handleCancel} className="bg-slate-600 px-4 py-2 rounded hover:bg-slate-500">
                                        لغو
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                };

                 return (
                    <div>
                        {!editingReport && <ReportForm isEditing={false} />}
                        <div className="space-y-4">
                            {reports.length === 0 && <p className="text-slate-400">هنوز گزارشی برای این کاربر ثبت نشده است.</p>}
                            {reports.map(item => (
                                <div key={item.id} className="bg-slate-700/50 p-4 rounded-lg">
                                    {editingReport?.id === item.id ? (
                                        <ReportForm isEditing={true} />
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm text-slate-300 whitespace-pre-wrap flex-grow">{item.content}</p>
                                                <div className="flex flex-shrink-0 ml-2">
                                                    <button onClick={() => handleStartEditReport(item)} className="text-violet-400 hover:text-violet-300 p-1"><Icon name="edit" className="w-5 h-5"/></button>
                                                    <button onClick={() => handleDeleteReport(item.id)} className="text-red-500 hover:text-red-400 p-1"><Icon name="trash" className="w-5 h-5"/></button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 text-left">{new Date(item.timestamp).toLocaleString('fa-IR')}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
             case 'subscription':
                return (
                    <div>
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <div className="flex items-baseline gap-4 mb-4">
                                <h3 className="text-lg font-semibold text-white">وضعیت فعلی:</h3>
                                <p className="text-xl font-bold text-violet-400">{calculateRemainingDays(currentUser.subscription_expires_at)}</p>
                            </div>
                             <h3 className="font-bold mb-2">تمدید اشتراک</h3>
                             <div className="flex items-center gap-2">
                                <input type="number" placeholder="تعداد روز" value={extensionDays} onChange={e => setExtensionDays(e.target.value)} className="w-32 bg-slate-700 p-2 rounded text-white" />
                                <button onClick={handleExtendSubscription} className="bg-violet-600 px-4 py-2 rounded hover:bg-violet-700">تمدید</button>
                             </div>
                        </div>

                         <h3 className="text-lg font-semibold text-white mb-2">تاریخچه تمدیدها</h3>
                         <div className="space-y-2">
                             {subscriptionHistory.length > 0 ? subscriptionHistory.map(item => (
                                 <div key={item.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center text-sm">
                                    <p className="text-slate-300">
                                        تمدید <span className="font-bold text-white">{item.extended_for_days}</span> روزه در تاریخ <span className="font-mono text-slate-400">{new Date(item.created_at).toLocaleDateString('fa-IR')}</span>
                                    </p>
                                    <p className="text-slate-400">
                                        انقضای جدید: <span className="font-mono">{new Date(item.new_expiry_date).toLocaleDateString('fa-IR')}</span>
                                    </p>
                                 </div>
                             )) : <p className="text-slate-400 text-sm">هنوز تمدیدی برای این کاربر ثبت نشده است.</p>}
                         </div>
                    </div>
                );
            case 'scenarios':
                return (
                    <div>
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <h3 className="font-bold mb-2">افزودن سناریوی جدید</h3>
                            <input type="number" placeholder="شماره سناریو" value={newScenario.number} onChange={e => setNewScenario({...newScenario, number: e.target.value})} className="w-full bg-slate-700 p-2 rounded mb-2" />
                             <div className="relative">
                                {scenarioImage && (
                                    <div className="absolute top-2 right-2 p-1 bg-slate-900/80 backdrop-blur-sm rounded-lg z-10">
                                        <img src={scenarioImage} alt="Preview" className="h-16 w-auto rounded" />
                                        <button onClick={() => setScenarioImage(null)} className="absolute -top-2 -left-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">&times;</button>
                                    </div>
                                )}
                                <textarea placeholder="محتوای سناریو" value={newScenario.content} onChange={e => setNewScenario({...newScenario, content: e.target.value})} className="w-full h-24 bg-slate-700 p-2 rounded mb-2"></textarea>
                             </div>
                              <div className="mt-2">
                                <label htmlFor="scenario-file-upload" className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors cursor-pointer w-fit">
                                    <Icon name="upload" className="w-4 h-4" />
                                    <span>ارسال عکس برای سناریو</span>
                                </label>
                                <input id="scenario-file-upload" type="file" className="hidden" accept="image/*" onChange={handleScenarioImageUpload} />
                                <p className="text-xs text-slate-500 mt-1">تصویر فقط برای رفرنس شماست و همراه سناریو ذخیره نمی‌شود.</p>
                            </div>
                            <button onClick={handleAddScenario} className="bg-violet-600 px-4 py-2 rounded mt-2">افزودن سناریو</button>
                        </div>
                         <div className="space-y-4">
                            {scenarios.length === 0 && <p className="text-slate-400">هنوز سناریویی برای این کاربر ثبت نشده است.</p>}
                            {scenarios.map(s => (
                                <div key={s.id} className="bg-slate-700/50 p-4 rounded-lg flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold">سناریو شماره {s.scenario_number}</h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{s.content}</p>
                                    </div>
                                    <button onClick={() => handleDeleteScenario(s.id)} className="text-red-500 hover:text-red-400 p-1 flex-shrink-0"><Icon name="trash" className="w-5 h-5"/></button>
                                </div>
                            ))}
                         </div>
                    </div>
                );
            case 'ideas':
                 return (
                    <div className="space-y-4">
                        {ideas.length > 0 ? ideas.map(i => (
                            <div key={i.id} className="bg-slate-700/50 p-4 rounded-lg flex justify-between items-start">
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{i.idea_text}</p>
                                <button onClick={() => handleDeleteIdea(i.id)} className="text-red-500 hover:text-red-400 p-1 flex-shrink-0"><Icon name="trash" className="w-5 h-5"/></button>
                            </div>
                        )) : <p>این کاربر هنوز ایده‌ای ثبت نکرده است.</p>}
                     </div>
                );
            case 'limits':
                 return (
                    <div>
                        <p className="text-slate-400 text-sm mb-4">میزان مصرف و سقف مجاز کاربر را مشاهده و در صورت نیاز مقادیر را ویرایش کنید. تغییرات بلافاصله اعمال می‌شوند.</p>
                        <div className="space-y-4">
                             {[
                                { key: 'story', usageKey: 'story_requests', limitKey: 'story_limit', label: 'تولید استوری (روزانه)' },
                                { key: 'caption_idea', usageKey: 'caption_idea_requests', limitKey: 'caption_idea_limit', label: 'تولید کپشن (روزانه)' },
                                { key: 'chat', usageKey: 'chat_messages', limitKey: 'chat_limit', label: 'پیام‌های چت (هفتگی)' },
                            ].map(({ key, usageKey, limitKey, label }) => (
                                 <div key={key} className="grid grid-cols-3 items-center gap-4">
                                    <label className="text-slate-300 col-span-1">{label}:</label>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <div>
                                            <label htmlFor={`${usageKey}_input`} className="text-xs text-slate-400 text-center block mb-1">مصرف شده</label>
                                            <input
                                                id={`${usageKey}_input`}
                                                type="number"
                                                value={usageLimits[usageKey as keyof typeof usageLimits]}
                                                onChange={(e) => setUsageLimits(prev => ({ ...prev, [usageKey]: parseInt(e.target.value, 10) || 0 }))}
                                                className="w-20 bg-slate-900 p-2 rounded text-center"
                                                aria-label='میزان مصرف شده'
                                            />
                                        </div>
                                        <span className='text-slate-400 self-end pb-2'>/</span>
                                         <div>
                                            <label htmlFor={`${limitKey}_input`} className="text-xs text-slate-400 text-center block mb-1">سقف مجاز</label>
                                            <input
                                                id={`${limitKey}_input`}
                                                type="number"
                                                value={totalLimits[limitKey as keyof typeof totalLimits]}
                                                onChange={(e) => setTotalLimits(prev => ({ ...prev, [limitKey]: parseInt(e.target.value, 10) || 0 }))}
                                                className="w-20 bg-slate-900 p-2 rounded text-center"
                                                aria-label='سقف مجاز'
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6">
                            <button onClick={handleSaveLimits} className="bg-violet-600 px-6 py-2 rounded hover:bg-violet-700">
                                ذخیره محدودیت‌ها
                            </button>
                        </div>
                    </div>
                );
        }
    };

    const TabButton: React.FC<{tab: DetailTab, label: string}> = ({tab, label}) => (
         <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-400'}`}>{label}</button>
    )

    return (
        <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center text-violet-400 hover:text-violet-300">
                    <Icon name="back" className="w-5 h-5 me-2"/> بازگشت به لیست کاربران
                </button>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">مدیریت کاربر: {currentUser.full_name}</h1>
            
             {notification && (
                <div className={`p-3 mb-4 rounded-lg text-sm transition-opacity duration-300 whitespace-pre-line ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'}`}>
                    {notification}
                </div>
            )}

            <div className="border-b border-slate-700 flex flex-wrap">
                <TabButton tab="about" label="درباره کاربر"/>
                <TabButton tab="subscription" label="اشتراک"/>
                <TabButton tab="limits" label="محدودیت‌ها"/>
                <TabButton tab="scenarios" label="سناریوها"/>
                <TabButton tab="ideas" label="ایده‌ها"/>
                <TabButton tab="plans" label="برنامه‌ها"/>
                <TabButton tab="reports" label="گزارشات"/>
            </div>
            <div className="bg-slate-800 p-6 rounded-b-lg">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default UserDetails;

import React, { useState, useEffect, useCallback } from 'react';
import { User, PostScenario, PostIdea, SubscriptionHistory, Plan, Report } from '../../types';
import * as db from '../../services/dbService';
import { generateCaption } from '../../services/geminiService';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';

interface UserDetailsProps {
    user: User;
    onBack: () => void;
    onUpdate: () => void; // To refresh admin notifications
}

type DetailTab = 'about' | 'subscription' | 'plans' | 'reports' | 'scenarios' | 'ideas' | 'limits';

const UserDetails: React.FC<UserDetailsProps> = ({ user, onBack, onUpdate }) => {
    const [currentUser, setCurrentUser] = useState<User>(user);
    const [activeTab, setActiveTab] = useState<DetailTab>('about');
    
    // About Tab
    const [about, setAbout] = useState(user.about_info || '');
    const [preferredName, setPreferredName] = useState(user.preferred_name || '');
    
    // Plans Tab
    const [plans, setPlans] = useState<Plan[]>([]);
    const [newPlanContent, setNewPlanContent] = useState('');

    // Reports Tab
    const [reports, setReports] = useState<Report[]>([]);
    const [newReportContent, setNewReportContent] = useState('');

    // Scenarios & Ideas
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [newScenario, setNewScenario] = useState({ number: '', content: '' });

    // Subscription
    const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
    const [extensionDays, setExtensionDays] = useState<string>('');
    
    // Limits
    const [usageLimits, setUsageLimits] = useState({
        story_requests: user.story_requests,
        caption_idea_requests: user.caption_idea_requests,
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
            setPlans(await db.getPlansForUser(freshUser.user_id));
            setReports(await db.getReportsForUser(freshUser.user_id));
            setScenarios(await db.getScenariosForUser(freshUser.user_id));
            setIdeas(await db.getIdeasForUser(freshUser.user_id));
            setSubscriptionHistory(await db.getSubscriptionHistory(freshUser.user_id));

            setUsageLimits({
                story_requests: freshUser.story_requests,
                caption_idea_requests: freshUser.caption_idea_requests,
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
            await db.updateUserInfo(user.user_id, { about_info: about, preferred_name: preferredName });
            showNotification('اطلاعات کاربر با موفقیت ذخیره شد.');
            refreshData(currentUser);
        } catch(e) {
            showNotification((e as Error).message);
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
        if (!newReportContent.trim()) return;
        try {
            await db.saveReportForUser(user.user_id, newReportContent);
            setNewReportContent('');
            await refreshData(currentUser);
            showNotification('گزارش جدید با موفقیت اضافه شد.');
        } catch (e) {
            showNotification(`خطا در افزودن گزارش: ${(e as Error).message}`);
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
            refreshData(currentUser);
        }
    }
    
    const handleDeleteScenario = async (id: number) => {
        if (window.confirm('با حذف این سناریو، یک کپشن برای کاربر تولید شده و سناریو بایگانی می‌شود. آیا مطمئن هستید؟')) {
            const scenarioToDelete = scenarios.find(s => s.id === id);
            if (scenarioToDelete) {
                try {
                    const captionContent = await generateCaption(user.about_info || '', scenarioToDelete.content);
                    const captionTitle = `کپشن سناریو شماره ${scenarioToDelete.scenario_number}`;
                    await db.addCaption(user.user_id, captionTitle, captionContent, scenarioToDelete.content);
                } catch (error) {
                    console.error("Caption generation failed during admin delete:", error);
                    alert("تولید کپشن خودکار با خطا مواجه شد، اما سناریو حذف می‌شود.");
                } finally {
                    await db.deleteScenario(id);
                    await db.logActivity(user.user_id, `سناریوی شماره ${scenarioToDelete.scenario_number} توسط مدیر حذف شد.`);
                    refreshData(currentUser);
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


    const renderTabContent = () => {
        switch (activeTab) {
            case 'about':
                return (
                     <div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">درباره کاربر (برای سناریوها)</label>
                                <textarea value={about} onChange={(e) => setAbout(e.target.value)} className="w-full h-40 bg-slate-900 p-2 rounded" placeholder="اطلاعات کسب‌وکار کاربر، حوزه فعالیت و..."></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">نام مورد خطاب (برای گفتگو)</label>
                                <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="w-full bg-slate-900 p-2 rounded" placeholder="مثلا: مجتبی" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <button onClick={handleSaveAbout} className="bg-violet-600 px-4 py-2 rounded hover:bg-violet-700">ذخیره تغییرات</button>
                        </div>
                    </div>
                );
            case 'plans':
            case 'reports':
                const isPlans = activeTab === 'plans';
                const items = isPlans ? plans : reports;
                const newContent = isPlans ? newPlanContent : setNewReportContent;
                const setNewContent = isPlans ? setNewPlanContent : setNewReportContent;
                const handleAdd = isPlans ? handleAddPlan : handleAddReport;
                const handleDelete = isPlans ? handleDeletePlan : handleDeleteReport;
                const title = isPlans ? 'برنامه' : 'گزارش';

                return (
                    <div>
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <h3 className="font-bold mb-2">افزودن {title} جدید</h3>
                            <div className="relative">
                                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full h-32 bg-slate-700 p-2 rounded mb-2" placeholder={`محتوای ${title} جدید را اینجا بنویسید...`}></textarea>
                            </div>
                            <button onClick={handleAdd} disabled={!newContent.trim()} className="bg-violet-600 px-4 py-2 rounded disabled:bg-slate-600">افزودن {title}</button>
                        </div>
                        <div className="space-y-4">
                            {items.length === 0 && <p className="text-slate-400">هنوز {title}ی برای این کاربر ثبت نشده است.</p>}
                            {items.map(item => (
                                <div key={item.id} className="bg-slate-700/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.content}</p>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-400 p-1 flex-shrink-0"><Icon name="trash" className="w-5 h-5"/></button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 text-left">{new Date(item.timestamp).toLocaleString('fa-IR')}</p>
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
                                <textarea placeholder="محتوای سناریو" value={newScenario.content} onChange={e => setNewScenario({...newScenario, content: e.target.value})} className="w-full h-24 bg-slate-700 p-2 pe-28 rounded mb-2"></textarea>
                                <div className="absolute top-1/2 -translate-y-1/2 right-3">
                                   <VoiceInput onTranscriptChange={(t) => setNewScenario({...newScenario, content: t})} currentValue={newScenario.content} />
                                </div>
                             </div>
                              <div className="mt-2">
                                <label htmlFor="scenario-file-upload" className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors cursor-pointer w-fit opacity-50" title="این قابلیت نیازمند تنظیمات سمت سرور است">
                                    <Icon name="upload" className="w-4 h-4" />
                                    <span>ارسال عکس/ویدیو (به زودی)</span>
                                </label>
                                <input id="scenario-file-upload" type="file" className="hidden" disabled />
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
import React, { useState, useEffect, useCallback } from 'react';
import { User, PostScenario, PostIdea, SubscriptionHistory } from '../../types';
import * as db from '../../services/dbService';
import { generateCaptionStream } from '../../services/geminiService';
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
    const [isEditing, setIsEditing] = useState(false);
    
    const [about, setAbout] = useState(user.about_info || '');
    const [preferredName, setPreferredName] = useState(user.preferred_name || '');
    const [plan, setPlan] = useState('');
    const [report, setReport] = useState('');
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [newScenario, setNewScenario] = useState({ number: '', content: '' });
    const [notification, setNotification] = useState('');

    // Subscription state
    const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
    const [extensionDays, setExtensionDays] = useState<string>('');


    const [usageLimits, setUsageLimits] = useState({
        story_requests: user.story_requests,
        caption_idea_requests: user.caption_idea_requests,
        image_requests: user.image_requests,
        chat_messages: user.chat_messages,
    });
    
    const [totalLimits, setTotalLimits] = useState({
        story_limit: user.story_limit ?? 2,
        caption_idea_limit: user.caption_idea_limit ?? 2,
        image_limit: user.image_limit ?? 35,
        chat_limit: user.chat_limit ?? 150,
    });

    const refreshData = useCallback(async (updatedUser?: User) => {
        const userToFetch = updatedUser || currentUser;
        const freshUser = await db.getUserById(userToFetch.user_id);
        if (!freshUser) {
            onBack(); // User might have been deleted
            return;
        }
        setCurrentUser(freshUser);
        setAbout(freshUser.about_info || '');
        setPreferredName(freshUser.preferred_name || '');
        
        const userPlan = await db.getPlanForUser(freshUser.user_id);
        setPlan(userPlan?.content || '');

        const userReports = await db.getReportsForUser(freshUser.user_id);
        setReport(userReports.map(r => `تاریخ: ${new Date(r.timestamp).toLocaleDateString('fa-IR')}\n${r.content}`).join('\n\n---\n\n') || '');

        const userScenarios = await db.getScenariosForUser(freshUser.user_id);
        setScenarios(userScenarios);

        const userIdeas = await db.getIdeasForUser(freshUser.user_id);
        setIdeas(userIdeas);
        
        const subHistory = await db.getSubscriptionHistory(freshUser.user_id);
        setSubscriptionHistory(subHistory);

        setUsageLimits({
            story_requests: freshUser.story_requests,
            caption_idea_requests: freshUser.caption_idea_requests,
            image_requests: freshUser.image_requests,
            chat_messages: freshUser.chat_messages,
        });
        setTotalLimits({
            story_limit: freshUser.story_limit ?? 2,
            caption_idea_limit: freshUser.caption_idea_limit ?? 2,
            image_limit: freshUser.image_limit ?? 35,
            chat_limit: freshUser.chat_limit ?? 150,
        });
        
        onUpdate();
    }, [currentUser, onUpdate, onBack]);

    useEffect(() => {
        setCurrentUser(user);
        refreshData(user);
    }, [user]);
    
    useEffect(() => {
        if(activeTab === 'ideas') {
            db.clearAdminNotifications('ideas');
            onUpdate();
        }
    }, [activeTab, onUpdate]);

    const handleSave = async () => {
        if (activeTab === 'about') await db.updateUserInfo(user.user_id, { about_info: about, preferred_name: preferredName });
        if (activeTab === 'plans') await db.savePlanForUser(user.user_id, plan);
        if (activeTab === 'reports') await db.saveReportForUser(user.user_id, report);
        setIsEditing(false);
        refreshData();
    };
    
     const handleSaveLimits = async () => {
        try {
            await Promise.all([
                db.updateUserUsageLimits(user.user_id, usageLimits),
                db.updateUserTotalLimits(user.user_id, totalLimits)
            ]);
            setNotification('محدودیت‌ها با موفقیت ذخیره شد.');
            refreshData();
        } catch (error) {
            console.error("Failed to save limits", error);
            setNotification(`خطا در ذخیره محدودیت‌ها: ${(error as Error).message}`);
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };

    const handleExtendSubscription = async () => {
        const days = parseInt(extensionDays, 10);
        if (isNaN(days) || days <= 0) {
            setNotification('لطفاً تعداد روز معتبری وارد کنید.');
            return;
        }

        const result = await db.extendSubscription(user.user_id, days);
        setNotification(result.message);
        if (result.success) {
            setExtensionDays('');
            refreshData();
        }
        setTimeout(() => setNotification(''), 5000);
    };

    const calculateRemainingDays = (expiryDate?: string): string => {
        if (!expiryDate) return 'تعریف نشده';
        const diff = new Date(expiryDate).getTime() - new Date().getTime();
        if (diff < 0) return 'منقضی شده';
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return `${days} روز`;
    };

    const handleDelete = async (type: 'plan' | 'report', id: number) => {
        const typeInFarsi = type === 'plan' ? 'برنامه' : 'گزارش';
        if (window.confirm(`آیا از حذف تمام ${typeInFarsi}‌های این کاربر مطمئن هستید؟`)) {
            if (type === 'plan') await db.deletePlanForUser(id);
            if (type === 'report') await db.deleteReportForUser(id);
        }
        refreshData();
    }
    
    const handleAddScenario = async () => {
        if (newScenario.number && newScenario.content) {
            await db.addScenarioForUser(user.user_id, parseInt(newScenario.number), newScenario.content);
            setNewScenario({ number: '', content: '' });
            refreshData();
        }
    }
    
    const handleDeleteScenario = async (id: number) => {
        if (window.confirm('با حذف این سناریو، یک کپشن برای کاربر تولید شده و سناریو بایگانی می‌شود. آیا مطمئن هستید؟')) {
            const scenarioToDelete = scenarios.find(s => s.id === id);
            if (scenarioToDelete) {
                try {
                    let captionContent = '';
                    const stream = generateCaptionStream(user.about_info || '', scenarioToDelete.content);
                    for await (const chunk of stream) {
                        captionContent += chunk;
                    }
                    const captionTitle = `کپشن سناریو شماره ${scenarioToDelete.scenario_number}`;
                    await db.addCaption(user.user_id, captionTitle, captionContent, scenarioToDelete.content);
                } catch (error) {
                    console.error("Caption generation failed during admin delete:", error);
                    alert("تولید کپشن خودکار با خطا مواجه شد، اما سناریو حذف می‌شود.");
                } finally {
                    await db.deleteScenario(id);
                    await db.logActivity(user.user_id, `سناریوی شماره ${scenarioToDelete.scenario_number} توسط مدیر حذف شد.`);
                    refreshData();
                }
            }
        }
    }
    
    const handleDeleteIdea = async (id: number) => {
        if (window.confirm('این ایده حذف شود؟')) {
            await db.deleteIdea(id);
            refreshData();
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
                                {isEditing ? (
                                    <div className="relative">
                                        <textarea value={about} onChange={(e) => setAbout(e.target.value)} className="w-full h-40 bg-slate-900 p-2 rounded" placeholder="اطلاعات کسب‌وکار کاربر، حوزه فعالیت و..."></textarea>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap p-2 min-h-[4rem] bg-slate-900/50 rounded">{about || 'ثبت نشده'}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">نام مورد خطاب (برای گفتگو)</label>
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        value={preferredName} 
                                        onChange={(e) => setPreferredName(e.target.value)} 
                                        className="w-full bg-slate-900 p-2 rounded"
                                        placeholder="مثلا: مجتبی"
                                    />
                                ) : (
                                    <p className="p-2 min-h-[1.5rem] bg-slate-900/50 rounded">{preferredName || 'ثبت نشده (از نام کامل استفاده می‌شود)'}</p>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 flex gap-4">
                            {isEditing ? (
                                <>
                                    <button onClick={handleSave} className="bg-violet-600 px-4 py-2 rounded">ذخیره</button>
                                    <button onClick={() => setIsEditing(false)} className="bg-slate-600 px-4 py-2 rounded">لغو</button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="bg-slate-700 px-4 py-2 rounded flex items-center"><Icon name="edit" className="w-4 h-4 me-2" />ویرایش</button>
                            )}
                        </div>
                    </div>
                );
            case 'plans':
            case 'reports':
                const content = activeTab === 'plans' ? plan : report;
                const setContent = activeTab === 'plans' ? setPlan : setReport;
                const title = activeTab === 'plans' ? 'برنامه‌ها' : 'گزارشات';
                const placeholder = `محتوای ${title} را اینجا وارد کنید...`;
                
                return (
                    <div>
                        {isEditing ? (
                            <div className="relative">
                                <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-64 bg-slate-900 p-2 ps-20 pe-4 rounded" placeholder={placeholder}></textarea>
                                <VoiceInput onTranscript={setContent} />
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap min-h-[4rem]">{content || `محتوایی برای ${title} ثبت نشده.`}</p>
                        )}
                        <div className="mt-4 flex gap-4">
                            {isEditing ? (
                                <>
                                    <button onClick={handleSave} className="bg-violet-600 px-4 py-2 rounded">ذخیره</button>
                                    <button onClick={() => setIsEditing(false)} className="bg-slate-600 px-4 py-2 rounded">لغو</button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="bg-slate-700 px-4 py-2 rounded flex items-center"><Icon name="edit" className="w-4 h-4 me-2" />ویرایش</button>
                            )}
                            {activeTab !== 'about' && content && <button onClick={() => handleDelete(activeTab === 'plans' ? 'plan' : 'report', user.user_id)} className="bg-red-800 px-4 py-2 rounded flex items-center"><Icon name="trash" className="w-4 h-4 me-2"/>حذف</button>}
                        </div>
                    </div>
                );
             case 'subscription':
                return (
                    <div>
                         {notification && (
                            <div className={`p-3 mb-4 rounded-lg text-sm ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                {notification}
                            </div>
                        )}
                        <div className="bg-slate-900/70 p-4 rounded-lg mb-6">
                            <div className="flex items-baseline gap-4 mb-4">
                                <h3 className="text-lg font-semibold text-white">وضعیت فعلی:</h3>
                                <p className="text-xl font-bold text-violet-400">{calculateRemainingDays(currentUser.subscription_expires_at)}</p>
                            </div>
                             <h3 className="font-bold mb-2">تمدید اشتراک</h3>
                             <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    placeholder="تعداد روز" 
                                    value={extensionDays} 
                                    onChange={e => setExtensionDays(e.target.value)} 
                                    className="w-32 bg-slate-700 p-2 rounded text-white" 
                                />
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
                                <textarea placeholder="محتوای سناریو" value={newScenario.content} onChange={e => setNewScenario({...newScenario, content: e.target.value})} className="w-full h-24 bg-slate-700 p-2 ps-20 pe-4 rounded mb-2"></textarea>
                                <VoiceInput onTranscript={(text) => setNewScenario(prev => ({...prev, content: text}))} />
                             </div>
                            <button onClick={handleAddScenario} className="bg-violet-600 px-4 py-2 rounded">افزودن سناریو</button>
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
                        {notification && (
                            <div className={`p-3 mb-4 rounded-lg text-sm ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                {notification}
                            </div>
                        )}
                        <div className="space-y-4">
                             {[
                                { key: 'story', usageKey: 'story_requests', limitKey: 'story_limit', label: 'تولید استوری (روزانه)' },
                                { key: 'caption_idea', usageKey: 'caption_idea_requests', limitKey: 'caption_idea_limit', label: 'تولید کپشن (روزانه)' },
                                { key: 'image', usageKey: 'image_requests', limitKey: 'image_limit', label: 'تولید عکس (هفتگی)' },
                                { key: 'chat', usageKey: 'chat_messages', limitKey: 'chat_limit', label: 'پیام‌های چت (هفتگی)' },
                            ].map(({ key, usageKey, limitKey, label }) => (
                                 <div key={key} className="grid grid-cols-3 items-center gap-4">
                                    <label htmlFor={key} className="text-slate-300 col-span-1">{label}:</label>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <input
                                            id={`${usageKey}_input`}
                                            type="number"
                                            value={usageLimits[usageKey as keyof typeof usageLimits]}
                                            onChange={(e) => setUsageLimits(prev => ({ ...prev, [usageKey]: parseInt(e.target.value, 10) || 0 }))}
                                            className="w-20 bg-slate-900 p-2 rounded text-center"
                                            aria-label='میزان مصرف شده'
                                        />
                                        <span className='text-slate-400'>/</span>
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
         <button onClick={() => {setActiveTab(tab); setIsEditing(false);}} className={`px-4 py-2 rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-400'}`}>{label}</button>
    )

    return (
        <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center text-violet-400 hover:text-violet-300">
                    <Icon name="back" className="w-5 h-5 me-2"/> بازگشت به لیست کاربران
                </button>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">مدیریت کاربر: {currentUser.full_name}</h1>
            
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
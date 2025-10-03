
import React, { useState, useEffect, useCallback } from 'react';
import { User, PostScenario, PostIdea } from '../../types';
import * as db from '../../services/dbService';
import { generateCaptionStream } from '../../services/geminiService';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';

interface UserDetailsProps {
    user: User;
    onBack: () => void;
    onUpdate: () => void; // To refresh admin notifications
}

type DetailTab = 'about' | 'plans' | 'reports' | 'scenarios' | 'ideas';

const UserDetails: React.FC<UserDetailsProps> = ({ user, onBack, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<DetailTab>('about');
    const [isEditing, setIsEditing] = useState(false);
    
    const [about, setAbout] = useState(user.about_info || '');
    const [plan, setPlan] = useState('');
    const [report, setReport] = useState('');
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [newScenario, setNewScenario] = useState({ number: '', content: '' });
    const [isVip, setIsVip] = useState(user.is_vip || false);

    const refreshData = useCallback(async () => {
        const userPlan = await db.getPlanForUser(user.user_id);
        setPlan(userPlan?.content || '');

        const userReports = await db.getReportsForUser(user.user_id);
        setReport(userReports.map(r => `تاریخ: ${new Date(r.timestamp).toLocaleDateString('fa-IR')}\n${r.content}`).join('\n\n---\n\n') || '');

        const userScenarios = await db.getScenariosForUser(user.user_id);
        setScenarios(userScenarios);

        const userIdeas = await db.getIdeasForUser(user.user_id);
        setIdeas(userIdeas);
        
        const freshUser = await db.getUserById(user.user_id);
        setIsVip(freshUser?.is_vip || false);
        
        onUpdate();
    }, [user.user_id, onUpdate]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);
    
    useEffect(() => {
        if(activeTab === 'ideas') {
            db.clearAdminNotifications('ideas');
            onUpdate();
        }
    }, [activeTab, onUpdate]);

    const handleSave = async () => {
        if (activeTab === 'about') await db.updateUserAbout(user.user_id, about);
        if (activeTab === 'plans') await db.savePlanForUser(user.user_id, plan);
        if (activeTab === 'reports') await db.saveReportForUser(user.user_id, report);
        setIsEditing(false);
        refreshData();
    };

    const handleVipToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVipStatus = e.target.checked;
        setIsVip(newVipStatus);
        await db.updateUserVipStatus(user.user_id, newVipStatus);
    }

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
            case 'plans':
            case 'reports':
                const content = activeTab === 'about' ? about : activeTab === 'plans' ? plan : report;
                const setContent = activeTab === 'about' ? setAbout : activeTab === 'plans' ? setPlan : setReport;
                const title = activeTab === 'about' ? 'درباره کاربر' : activeTab === 'plans' ? 'برنامه‌ها' : 'گزارشات';
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
        }
    };

    const TabButton: React.FC<{tab: DetailTab, label: string}> = ({tab, label}) => (
         <button onClick={() => {setActiveTab(tab); setIsEditing(false);}} className={`px-4 py-2 rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-400'}`}>{label}</button>
    )

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <button onClick={onBack} className="flex items-center text-violet-400 hover:text-violet-300">
                    <Icon name="back" className="w-5 h-5 me-2"/> بازگشت به لیست کاربران
                </button>
                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg">
                    <label htmlFor="vip-toggle" className="font-bold text-yellow-400">دسترسی VIP</label>
                    <input 
                        type="checkbox"
                        id="vip-toggle"
                        checked={isVip}
                        onChange={handleVipToggle}
                        className="w-5 h-5 rounded text-violet-500 bg-slate-700 border-slate-600 focus:ring-violet-500"
                    />
                </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">مدیریت کاربر: {user.full_name}</h1>
            
            <div className="border-b border-slate-700 flex flex-wrap">
                <TabButton tab="about" label="درباره کاربر"/>
                <TabButton tab="plans" label="برنامه‌ها"/>
                <TabButton tab="reports" label="گزارشات"/>
                <TabButton tab="scenarios" label="سناریوها"/>
                <TabButton tab="ideas" label="ایده‌ها"/>
            </div>
            <div className="bg-slate-800 p-6 rounded-b-lg">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default UserDetails;

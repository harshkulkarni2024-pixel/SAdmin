import React, { useState, useEffect, useCallback } from 'react';
import { PostScenario } from '../../types';
import * as db from '../../services/dbService';
import { generateCaption, generateHooksOrCTAs, AI_INIT_ERROR } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';
import { UserViewType } from './UserView';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

interface PostScenariosProps {
  setActiveView: (view: UserViewType) => void;
}

const PostScenarios: React.FC<PostScenariosProps> = ({ setActiveView }) => {
    const { user, updateUser: onUserUpdate } = useUser();
    const showNotification = useNotification();
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<PostScenario | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // State for Hooks/CTAs
    const [generatedContent, setGeneratedContent] = useState<{ hooks: string, ctas: string }>({ hooks: '', ctas: '' });
    const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
    const [isGeneratingCtas, setIsGeneratingCtas] = useState(false);


    const refreshScenarios = useCallback(async () => {
        if (!user) return;
        const userScenarios = await db.getScenariosForUser(user.user_id);
        setScenarios(userScenarios);
        onUserUpdate(); 
    }, [user, onUserUpdate]);

    useEffect(() => {
        if(user) {
            refreshScenarios();
            db.clearUserNotifications('scenarios', user.user_id);
            onUserUpdate();
        }
    }, [user, refreshScenarios, onUserUpdate]);

    const handleSelectScenario = (scenario: PostScenario) => {
        setSelectedScenario(scenario);
        // Reset generated content when selecting a new scenario
        setGeneratedContent({ hooks: '', ctas: '' });
    };

    const handleRecord = async (scenarioId: number) => {
        if (!user) return;
        setIsLoading(true);
        showNotification('عالی! در حال تولید کپشن برای شما...', 'info');
        const scenarioToProcess = await db.getScenarioById(scenarioId);
        if (scenarioToProcess) {
            try {
                const captionContent = await generateCaption(user.about_info || '', scenarioToProcess.content);
                
                if (captionContent && captionContent.includes(AI_INIT_ERROR)) {
                    throw new Error(AI_INIT_ERROR);
                }
                
                if (captionContent && captionContent.trim()) {
                    const captionTitle = `کپشن سناریو شماره ${scenarioToProcess.scenario_number}`;
                    await db.addCaption(user.user_id, captionTitle, captionContent, scenarioToProcess.content);
                    await db.logActivity(user.user_id, `سناریو شماره ${scenarioToProcess.scenario_number} را تایید کرد.`);
                    showNotification(`آفرین! کپشن برای سناریو شماره ${scenarioToProcess.scenario_number} تولید شد و در بخش «کپشن‌ها» ذخیره شد.`, 'success');
                } else {
                     throw new Error("پاسخ خالی از هوش مصنوعی دریافت شد.");
                }

            } catch (err) {
                const errorMessage = (err as Error).message;
                console.error("Caption Generation Error:", errorMessage);
                showNotification(`خطا در تولید کپشن: ${errorMessage}`, 'error');
            } finally {
                await db.deleteScenario(scenarioId);
                refreshScenarios();
                setSelectedScenario(null);
                setIsLoading(false);
            }
        }
    };
    
    const handleGenerateHooksOrCTAs = async (type: 'hooks' | 'ctas') => {
        if (!selectedScenario) return;
        
        if (type === 'hooks') setIsGeneratingHooks(true);
        else setIsGeneratingCtas(true);

        try {
            const result = await generateHooksOrCTAs(selectedScenario.content, type);
            setGeneratedContent(prev => ({ ...prev, [type]: result }));
        } catch (err) {
            showNotification(`خطا در تولید محتوا: ${(err as Error).message}`, 'error');
        } finally {
            if (type === 'hooks') setIsGeneratingHooks(false);
            else setIsGeneratingCtas(false);
        }
    };

    if (!user) {
        return <Loader />;
    }

    if (selectedScenario) {
        return (
            <div className="max-w-3xl mx-auto animate-fade-in">
                <button onClick={() => setSelectedScenario(null)} className="flex items-center text-violet-400 hover:text-violet-300 mb-4">
                    <Icon name="back" className="w-5 h-5 ms-2" />
                    بازگشت به لیست
                </button>
                <div className="bg-slate-800 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-white">🎬 سناریو شماره {selectedScenario.scenario_number}</h2>
                    <p className="text-slate-300 whitespace-pre-wrap">{selectedScenario.content}</p>
                    
                    <div className="mt-6 border-t border-slate-700 pt-6 space-y-3">
                         <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => handleGenerateHooksOrCTAs('hooks')} disabled={isGeneratingHooks || !!generatedContent.hooks} className="flex-1 flex justify-center items-center bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed">
                                {isGeneratingHooks ? <Loader /> : '✨ ۵۰ قلاب جدید بگیر'}
                            </button>
                            <button onClick={() => handleGenerateHooksOrCTAs('ctas')} disabled={isGeneratingCtas || !!generatedContent.ctas} className="flex-1 flex justify-center items-center bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed">
                                {isGeneratingCtas ? <Loader /> : '🚀 ۵۰ کال تو اکشن جدید بگیر'}
                            </button>
                        </div>
                        <button 
                            onClick={() => handleRecord(selectedScenario.id)}
                            disabled={isLoading}
                            className="w-full flex justify-center items-center bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-slate-600 transition-colors"
                        >
                            {isLoading ? <Loader /> : '✅ این ویدیو را ضبط کردم!'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {generatedContent.hooks && (
                        <details className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <summary className="font-semibold cursor-pointer text-violet-300">✨ مشاهده ۵۰ قلاب تولید شده</summary>
                            <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ol:pl-4 whitespace-pre-wrap mt-4" dangerouslySetInnerHTML={{ __html: generatedContent.hooks.replace(/\n/g, '<br/>') }} />
                        </details>
                    )}
                    {generatedContent.ctas && (
                        <details className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <summary className="font-semibold cursor-pointer text-violet-300">🚀 مشاهده ۵۰ کال تو اکشن تولید شده</summary>
                            <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ol:pl-4 whitespace-pre-wrap mt-4" dangerouslySetInnerHTML={{ __html: generatedContent.ctas.replace(/\n/g, '<br/>') }} />
                        </details>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">سناریوهای پست شما</h1>
            <p className="text-slate-400 mb-6">این‌ها ایده‌های ویدیویی هستن که منتظر هنرنمایی تو هستن.</p>

            {scenarios.length === 0 ? (
                <div className="text-center bg-slate-800 p-8 rounded-lg">
                    <p className="text-slate-300">هنوز سناریویی برای شما ثبت نشده است.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios.map(scenario => (
                        <div key={scenario.id} className="bg-slate-800 p-5 rounded-lg flex flex-col justify-between shadow-lg hover:shadow-violet-500/20 transition-shadow">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">🎬 سناریو شماره {scenario.scenario_number}</h3>
                                <p className="text-slate-400 line-clamp-4">{scenario.content}</p>
                            </div>
                            <button onClick={() => handleSelectScenario(scenario)} className="mt-4 w-full bg-slate-700 text-white py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors">
                                مشاهده سناریوی کامل
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PostScenarios;
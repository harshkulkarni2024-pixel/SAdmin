import React, { useState, useEffect, useCallback } from 'react';
import { User, PostScenario } from '../../types';
import * as db from '../../services/dbService';
import { generateCaption, generateHooksOrCTAs, AI_INIT_ERROR } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';
import { UserViewType } from './UserView';
import { Modal } from '../common/Modal';

interface PostScenariosProps {
  user: User;
  setActiveView: (view: UserViewType) => void;
  onUserUpdate: () => void;
}

const PostScenarios: React.FC<PostScenariosProps> = ({ user, setActiveView, onUserUpdate }) => {
    const [scenarios, setScenarios] = useState<PostScenario[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<PostScenario | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState('');
    const [error, setError] = useState('');
    
    // State for Hooks/CTAs Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState('');
    const [isModalLoading, setIsModalLoading] = useState(false);

    const refreshScenarios = useCallback(async () => {
        const userScenarios = await db.getScenariosForUser(user.user_id);
        setScenarios(userScenarios);
        onUserUpdate(); 
    }, [user.user_id, onUserUpdate]);

    useEffect(() => {
        refreshScenarios();
        db.clearUserNotifications('scenarios', user.user_id);
        onUserUpdate();
    }, [refreshScenarios, onUserUpdate, user.user_id]);

    const handleRecord = async (scenarioId: number) => {
        setIsLoading(true);
        setError('');
        setNotification('عالی! در حال تولید کپشن برای شما...');
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
                    setNotification(`آفرین! کپشن برای سناریو شماره ${scenarioToProcess.scenario_number} تولید شد. می‌تونی تو بخش «کپشن‌ها» پیداش کنی.`);
                } else {
                     throw new Error("پاسخ خالی از هوش مصنوعی دریافت شد.");
                }

            } catch (err) {
                const errorMessage = (err as Error).message;
                console.error("Caption Generation Error:", errorMessage);
                setError(`خطا در تولید کپشن: ${errorMessage}`);
                setNotification('');
            } finally {
                await db.deleteScenario(scenarioId);
                refreshScenarios();
                setSelectedScenario(null);
                setIsLoading(false);
                setTimeout(() => {
                    setNotification('');
                    setError('');
                }, 5000);
            }
        }
    };
    
    const handleGenerateHooksOrCTAs = async (type: 'hooks' | 'ctas') => {
        if (!selectedScenario) return;
        
        setIsModalLoading(true);
        setModalTitle(`در حال تولید ۵۰ ${type === 'hooks' ? 'قلاب' : 'کال تو اکشن'}...`);
        setModalContent('');
        setIsModalOpen(true);

        try {
            const result = await generateHooksOrCTAs(selectedScenario.content, type);
            setModalContent(result);
        } catch (err) {
            setModalContent(`خطا در تولید محتوا: ${(err as Error).message}`);
        } finally {
            setIsModalLoading(false);
            setModalTitle(`۵۰ ${type === 'hooks' ? 'قلاب' : 'کال تو اکشن'} برای سناریو شما`);
        }
    };

    if (selectedScenario) {
        return (
            <div className="max-w-3xl mx-auto animate-fade-in">
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
                    {isModalLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader /></div>
                    ) : (
                        <div className="prose prose-invert prose-p:my-2 prose-ol:pl-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: modalContent.replace(/\n/g, '<br/>') }} />
                    )}
                </Modal>
                <button onClick={() => setSelectedScenario(null)} className="flex items-center text-violet-400 hover:text-violet-300 mb-4">
                    <Icon name="back" className="w-5 h-5 ms-2" />
                    بازگشت به لیست
                </button>
                <div className="bg-slate-800 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-white">🎬 سناریو شماره {selectedScenario.scenario_number}</h2>
                    <p className="text-slate-300 whitespace-pre-wrap">{selectedScenario.content}</p>
                    
                    <div className="mt-6 border-t border-slate-700 pt-6 space-y-3">
                         <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => handleGenerateHooksOrCTAs('hooks')} className="flex-1 text-center bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors">
                                ✨ ۵۰ قلاب جدید بگیر
                            </button>
                            <button onClick={() => handleGenerateHooksOrCTAs('ctas')} className="flex-1 text-center bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors">
                                🚀 ۵۰ کال تو اکشن جدید بگیر
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
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">سناریوهای پست شما</h1>
            <p className="text-slate-400 mb-6">این‌ها ایده‌های ویدیویی هستن که منتظر هنرنمایی تو هستن.</p>

            {notification && (
                <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-lg mb-6 text-center">
                    {notification}
                </div>
            )}
             {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-center">
                    {error}
                </div>
            )}


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
                            <button onClick={() => setSelectedScenario(scenario)} className="mt-4 w-full bg-slate-700 text-white py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors">
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

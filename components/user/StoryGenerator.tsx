import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { generateStoryScenarioStream } from '../../services/geminiService';
import { incrementUsage, saveStoryHistory, getStoryHistory } from '../../services/dbService';
import { Loader } from '../common/Loader';
import { VoiceInput } from '../common/VoiceInput';
import { Icon } from '../common/Icon';

interface StoryGeneratorProps {
    user: User;
    onUserUpdate: () => void;
}

const StoryGenerator: React.FC<StoryGeneratorProps> = ({ user, onUserUpdate }) => {
    const [idea, setIdea] = useState('');
    const [currentScenario, setCurrentScenario] = useState('');
    const [history, setHistory] = useState<{ id: number; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            const userHistory = await getStoryHistory(user.user_id);
            setHistory(userHistory);
        };
        fetchHistory();
    }, [user.user_id]);

    const handleGenerate = async () => {
        if (!idea.trim()) {
            setError('لطفاً ایده‌ای برای استوری خود ارائه دهید.');
            return;
        }
        
        if (user.story_requests >= 1) {
             setError("شما امروز سناریوی خود را دریافت کرده‌اید. لطفاً فردا مجدداً مراجعه کنید!");
             onUserUpdate(); // Refresh user state just in case
             return;
        }

        setIsLoading(true);
        setError('');
        setCurrentScenario('');
        try {
            let fullScenario = '';
            const stream = generateStoryScenarioStream(user.about_info || '', idea);
            for await (const chunk of stream) {
                fullScenario += chunk;
                setCurrentScenario(prev => prev + chunk);
            }
            await saveStoryHistory(user.user_id, fullScenario);
            const updatedHistory = await getStoryHistory(user.user_id);
            setHistory(updatedHistory);
            await incrementUsage(user.user_id, 'story');
            onUserUpdate();
        } catch (e) {
            setError('تولید سناریو با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsLoading(false);
            setIdea('');
        }
    };

    const isLimitReached = user.story_requests >= 1;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">تولیدکننده سناریو استوری</h1>
            <p className="text-sm text-slate-400 mb-6">محدودیت روزانه: {user.story_requests} / 1. ایده اصلی استوری امروزت چیه؟</p>

            {isLimitReached && !isLoading && !currentScenario && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-center">
                    شما به محدودیت روزانه تولید استوری رسیده‌اید. فردا دوباره سر بزنید!
                </div>
            )}

            {!isLimitReached && (
                 <div className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="مثلاً: آنباکسینگ محصول جدید، یک روز از زندگی من، یا پاسخ به سوالات مخاطبان..."
                            className="w-full h-32 p-4 pe-4 ps-20 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                            disabled={isLoading}
                        />
                        <VoiceInput onTranscript={setIdea} disabled={isLoading} />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !idea.trim()}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader /> : 'تولید سناریو'}
                    </button>
                 </div>
            )}
            
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
            
            {isLoading && !currentScenario && (
                <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700 text-center">
                    <Loader />
                    <p className="text-slate-400 mt-2">در حال تولید سناریو... لطفاً منتظر بمانید.</p>
                </div>
            )}

            {currentScenario && (
                <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-2xl font-bold text-violet-400 mb-4">سناریوی جدید شما 🚀</h2>
                    <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: currentScenario }} />
                </div>
            )}

            {history.length > 0 && !currentScenario && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-white mb-4">تاریخچه تولیدات شما</h2>
                    <div className="space-y-4">
                        {history.map(item => (
                            <div key={item.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <div className="prose prose-sm prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: item.content }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryGenerator;

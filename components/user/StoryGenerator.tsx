
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

const GOALS = [
    { key: 'sales', text: 'افزایش فروش', emoji: '🚀' },
    { key: 'engagement', text: 'افزایش تعامل (لایک، کامنت)', emoji: '❤️' },
    { key: 'followers', text: 'جذب فالوور جدید', emoji: '✨' },
    { key: 'trust', text: 'اعتمادسازی و ارتباط با مخاطب', emoji: '🤝' },
    { key: 'education', text: 'آموزش یا اطلاع‌رسانی', emoji: '💡' },
];

// Helper to clean HTML for clipboard by converting <b> to markdown bold
const cleanHtmlForCopy = (html: string) => {
    const tempDiv = document.createElement('div');
    // Replace <b> and </b> tags with markdown bold, then strip all other HTML tags
    tempDiv.innerHTML = html.replace(/<b>/gi, '').replace(/<\/b>/gi, '');
    return tempDiv.textContent || tempDiv.innerText || '';
};


const StoryGenerator: React.FC<StoryGeneratorProps> = ({ user, onUserUpdate }) => {
    const [goal, setGoal] = useState('');
    const [idea, setIdea] = useState('');
    const [yesterdayFeedback, setYesterdayFeedback] = useState('');
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
        if (!goal) {
            setError('لطفاً هدف خود را از استوری امروز مشخص کنید.');
            return;
        }
        if (!idea.trim()) {
            setError('لطفاً ایده‌ای برای استوری خود ارائه دهید.');
            return;
        }
        
        if (user.story_requests >= 2) {
             setError("شما امروز به سقف تولید سناریو رسیده‌اید. لطفاً فردا مجدداً مراجعه کنید!");
             onUserUpdate(); // Refresh user state just in case
             return;
        }

        setIsLoading(true);
        setError('');
        setCurrentScenario('');
        try {
            let fullScenario = '';
            const stream = generateStoryScenarioStream(user.about_info || '', goal, idea, yesterdayFeedback);
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
            setError((e as Error).message || 'تولید سناریو با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsLoading(false);
            setIdea('');
            setYesterdayFeedback('');
        }
    };

    const isLimitReached = user.story_requests >= 2;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">تولیدکننده سناریو استوری</h1>
            <p className="text-sm text-slate-400 mb-6">محدودیت روزانه: {user.story_requests} / 2. با ارائه بازخورد از استوری دیروز، به هوش مصنوعی کمک کن سناریوی بهتری برای امروزت بنویسه.</p>

            {isLimitReached && !isLoading && !currentScenario && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-center">
                    شما به محدودیت روزانه تولید استوری رسیده‌اید. فردا دوباره سر بزنید!
                </div>
            )}

            {!isLimitReached && (
                 <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            ۱. هدف شما از استوری امروز چیست؟
                        </label>
                         <div className="flex flex-wrap gap-2">
                            {GOALS.map(g => (
                                <button
                                    key={g.key}
                                    onClick={() => setGoal(g.text)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 text-sm rounded-lg transition-colors border ${goal === g.text ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-300'}`}
                                >
                                    {g.text} {g.emoji}
                                </button>
                             ))}
                         </div>
                     </div>
                    <div>
                        <label htmlFor="yesterdayFeedback" className="block text-sm font-medium text-slate-300 mb-2">
                             ۲. استوری دیروزت چطور بود؟ (اختیاری)
                            <span className="text-xs text-slate-400 block">اگه درموردش بهم بگی، میتونم در استوری امروزت خیلی بهتر کمکت کنم.</span>
                        </label>
                        <div className="relative">
                            <textarea
                                id="yesterdayFeedback"
                                value={yesterdayFeedback}
                                onChange={(e) => setYesterdayFeedback(e.target.value)}
                                placeholder="مثلاً: بازخوردها عالی بود، اما بازدید کمی گرفت."
                                className="w-full h-24 p-4 pe-4 ps-20 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                                disabled={isLoading}
                            />
                            <VoiceInput onTranscript={setYesterdayFeedback} disabled={isLoading} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="idea" className="block text-sm font-medium text-slate-300 mb-2">
                            ۳. ایده اصلی استوری امروزت چیه؟
                        </label>
                         <div className="relative">
                            <textarea
                                id="idea"
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder="مثلاً: آنباکسینگ محصول جدید، یک روز از زندگی من، یا پاسخ به سوالات مخاطبان..."
                                className="w-full h-32 p-4 pe-4 ps-20 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                                disabled={isLoading}
                            />
                            <VoiceInput onTranscript={setIdea} disabled={isLoading} />
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !idea.trim() || !goal}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader /> : 'تولید سناریو'}
                    </button>
                 </div>
            )}
            
            {error && <p className="text-red-400 mt-4 text-center whitespace-pre-line">{error}</p>}
            
            {isLoading && !currentScenario && (
                <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700 text-center">
                    <div className="text-4xl animate-bounce">🚀</div>
                    <p className="text-slate-300 mt-2 text-lg font-semibold">در حال پرتاب ایده‌ها به سمت خلاقیت...</p>
                    <p className="text-slate-400 mt-1">هوش مصنوعی در حال نوشتن یک سناریوی بی‌نظیر برای شماست. لطفاً کمی صبر کنید.</p>
                </div>
            )}

            {currentScenario && (
                <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-2xl font-bold text-violet-400 mb-4">سناریوی جدید شما 🚀</h2>
                     <div className="space-y-4">
                        {currentScenario.split('---').map((part, index) => {
                            const trimmedPart = part.trim();
                            if (!trimmedPart) return null;
                            return (
                                <div key={index} className="relative bg-slate-900/50 p-4 rounded-lg border border-slate-700 group">
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(cleanHtmlForCopy(trimmedPart))}
                                        className="absolute top-2 left-2 bg-slate-600 text-slate-300 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-600 hover:text-white"
                                        title="کپی متن"
                                    >
                                        کپی
                                    </button>
                                    <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: trimmedPart }} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {history.length > 0 && !currentScenario && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-white mb-4">۱۰ سناریوی اخیر شما</h2>
                    <div className="space-y-4">
                        {history.map(item => (
                             <div key={item.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <div className="space-y-4">
                                    {item.content.split('---').map((part, index) => {
                                        const trimmedPart = part.trim();
                                        if (!trimmedPart) return null;
                                        return (
                                             <div key={index} className="prose prose-sm prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: trimmedPart }} />
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryGenerator;

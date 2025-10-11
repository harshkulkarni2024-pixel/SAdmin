
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../../types';
// Fix: Renamed handleGeminiError to handleAiError as per the exported function name from geminiService.
import { generateStoryScenario, StoryContent, handleAiError } from '../../services/geminiService';
import { incrementUsage, saveStoryHistory, getStoryHistory } from '../../services/dbService';
import { Loader } from '../common/Loader';
import { VoiceInput } from '../common/VoiceInput';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

interface StoryGeneratorProps {
    // Props are now handled by context
}

const GOALS = [
    { key: 'sales', text: 'افزایش فروش', emoji: '🚀' },
    { key: 'engagement', text: 'افزایش تعامل (لایک، کامنت)', emoji: '❤️' },
    { key: 'followers', text: 'جذب فالوور جدید', emoji: '✨' },
    { key: 'trust', text: 'اعتمادسازی و ارتباط با مخاطب', emoji: '🤝' },
    { key: 'education', text: 'آموزش یا اطلاع‌رسانی', emoji: '💡' },
];

const StoryGenerator: React.FC<StoryGeneratorProps> = () => {
    const { user, updateUser: onUserUpdate } = useUser();
    const showNotification = useNotification();
    const [goal, setGoal] = useState('');
    const [idea, setIdea] = useState('');
    const [yesterdayFeedback, setYesterdayFeedback] = useState('');
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentScenario, setCurrentScenario] = useState<StoryContent[] | null>(null);
    const [history, setHistory] = useState<{ id: number; content: string }[]>([]);
    const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [copiedSlide, setCopiedSlide] = useState<number | null>(null);

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader />
            </div>
        );
    }

    const dailyLimit = user.story_limit ?? 2;

    const fetchHistory = useCallback(async () => {
        const userHistory = await getStoryHistory(user.user_id);
        setHistory(userHistory);
    }, [user.user_id]);
    
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setUploadedImage({
                    data: base64String,
                    mime: file.type,
                    url: URL.createObjectURL(file)
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!goal || (!idea.trim() && !uploadedImage)) {
            setError('لطفاً هدف و ایده خود را مشخص کنید.');
            return;
        }
        if (user.story_requests >= dailyLimit) {
            setError("شما به سقف تولید روزانه سناریو رسیده‌اید.");
            onUserUpdate();
            return;
        }

        setIsLoading(true);
        setError('');
        setCurrentScenario(null);
        const currentImage = uploadedImage;

        try {
            const result = await generateStoryScenario(user.about_info || '', goal, idea, yesterdayFeedback, currentImage ?? undefined);
            
            if (result && result.slides) {
                setCurrentScenario(result.slides);
                const scenarioString = JSON.stringify(result);
                await saveStoryHistory(user.user_id, scenarioString);
                await fetchHistory();
                await incrementUsage(user.user_id, 'story');
                onUserUpdate();
            } else {
                throw new Error("پاسخ دریافتی از هوش مصنوعی ساختار معتبری ندارد.");
            }

        } catch (e) {
            // Fix: Renamed handleGeminiError to handleAiError to match the imported function.
            const friendlyError = handleAiError(e);
            setError(friendlyError);
        } finally {
            setIsLoading(false);
            setIdea('');
            setYesterdayFeedback('');
            setUploadedImage(null);
            if (currentImage) URL.revokeObjectURL(currentImage.url);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedSlide(index);
        showNotification('متن روی استوری با موفقیت کپی شد!', 'success');
        setTimeout(() => setCopiedSlide(null), 2000);
    }

    const parseAndRenderHistory = (content: string) => {
        try {
            const parsed = JSON.parse(content);
            if (parsed.slides && Array.isArray(parsed.slides)) {
                return renderScenarioSlides(parsed.slides);
            }
        } catch (e) {
            // Fallback for old text-based history items
            return <p className="text-slate-400 p-4">قالب این سناریوی قدیمی پشتیبانی نمی‌شود.</p>;
        }
        return null;
    }


    const isLimitReached = user.story_requests >= dailyLimit;

    const renderScenarioSlides = (slides: StoryContent[]) => {
        return slides.map((slide, index) => (
             <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
                {slide.title && <h3 className="text-md font-bold text-white bg-violet-800/50 p-2 rounded-md inline-block">{slide.title}</h3>}
                {slide.instruction && (
                     <div>
                        <p className="font-semibold text-violet-300">اینو بگو:</p>
                        <p className="text-slate-300 whitespace-pre-wrap">{slide.instruction}</p>
                    </div>
                )}
                 {slide.storyText && (
                    <div className="border-t border-slate-700 pt-4">
                         <div className="flex justify-between items-center">
                            <p className="font-semibold text-violet-300">متن روی استوری:</p>
                             <button onClick={() => handleCopy(slide.storyText, index)} className="bg-slate-600 text-slate-300 px-3 py-1 text-xs rounded hover:bg-violet-600 hover:text-white transition-colors">
                                {copiedSlide === index ? 'کپی شد!' : 'کپی متن روی استوری'}
                            </button>
                         </div>
                        <p className="text-white whitespace-pre-wrap mt-2">{slide.storyText}</p>
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">تولیدکننده سناریو استوری</h1>
            <p className="text-sm text-slate-400 mb-6">محدودیت روزانه: {user.story_requests} / {dailyLimit}. با ارائه بازخورد از استوری دیروز، به هوش مصنوعی کمک کن سناریوی بهتری برای امروزت بنویسه.</p>

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
                        </label>
                         <p className="text-xs text-slate-400 mb-2">اگه درموردش بهم بگی، میتونم در استوری امروزت خیلی بهتر کمکت کنم.</p>
                        <div className="relative">
                            <textarea
                                id="yesterdayFeedback"
                                value={yesterdayFeedback}
                                onChange={(e) => setYesterdayFeedback(e.target.value)}
                                placeholder="مثلاً: بازخوردها عالی بود، اما بازدید کمی گرفت."
                                className="w-full h-24 p-4 pb-14 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                                disabled={isLoading}
                            />
                            <div className="absolute bottom-3 left-3">
                                <VoiceInput onTranscriptChange={setYesterdayFeedback} currentValue={yesterdayFeedback} disabled={isLoading} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="idea" className="block text-sm font-medium text-slate-300 mb-2">
                            ۳. پیشنهاد کالا یا خدماتت برای استوری امروز؟
                        </label>
                        <p className="text-xs text-slate-400 mb-2">مثلاً: آنباکسینگ محصول جدید، یک روز از زندگی من، یا پاسخ به سوالات مخاطبان...</p>
                         <div className="relative">
                             {uploadedImage && (
                                <div className="absolute top-2 right-2 p-1 bg-slate-900/80 backdrop-blur-sm rounded-lg z-10">
                                    <img src={uploadedImage.url} alt="Preview" className="h-16 w-auto rounded" />
                                    <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -left-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">&times;</button>
                                </div>
                            )}
                            <textarea
                                id="idea"
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder="ایده اصلی، محصول یا خدماتی که می‌خوای معرفی کنی رو اینجا بنویس..."
                                className="w-full h-32 p-4 pb-14 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                                disabled={isLoading}
                            />
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-white" title="آپلود عکس" disabled={isLoading}>
                                    <Icon name="paperclip" className="w-5 h-5" />
                                </button>
                                <VoiceInput onTranscriptChange={setIdea} currentValue={idea} disabled={isLoading} />
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || (!idea.trim() && !uploadedImage) || !goal}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader /> : 'تولید سناریو'}
                    </button>
                 </div>
            )}
            
            {error && <p className="text-red-400 mt-4 text-center whitespace-pre-line">{error}</p>}
            
            {isLoading && (
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
                        {renderScenarioSlides(currentScenario)}
                    </div>
                </div>
            )}

            {history.length > 0 && !currentScenario && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-white mb-4">۱۰ سناریوی اخیر شما</h2>
                    <div className="space-y-2">
                        {history.map(item => (
                             <div key={item.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <button 
                                    className="w-full p-4 text-right flex justify-between items-center hover:bg-slate-700/50"
                                    onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                                >
                                    <span className="font-semibold text-white">
                                        سناریوی تولید شده در {new Date(item.id).toLocaleDateString('fa-IR')}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${expandedHistoryId === item.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {expandedHistoryId === item.id && (
                                     <div className="p-4 border-t border-slate-700 space-y-4">
                                        {parseAndRenderHistory(item.content)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryGenerator;
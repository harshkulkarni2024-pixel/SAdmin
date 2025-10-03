
import React, { useState, useEffect, useCallback } from 'react';
import { getLatestAlgorithmNews } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';

interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    };
}

const AlgorithmNews: React.FC = () => {
    const [article, setArticle] = useState('');
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const fetchNews = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        setError('');
        const cacheKey = 'instagram_algorithm_news';
        
        if (!forceRefresh) {
            const cachedData = localStorage.getItem(cacheKey);
            const today = new Date().toISOString().split('T')[0];

            if (cachedData) {
                try {
                    const { date, article: cachedArticle, sources: cachedSources } = JSON.parse(cachedData);
                    if (date === today && cachedArticle) {
                        setArticle(cachedArticle);
                        setSources(cachedSources || []);
                        setIsLoading(false);
                        return;
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }
        
        if (forceRefresh) {
            localStorage.removeItem(cacheKey);
        }

        try {
            const { text, groundingChunks } = await getLatestAlgorithmNews();
            setArticle(text);
            setSources(groundingChunks || []);
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(cacheKey, JSON.stringify({ date: today, article: text, sources: groundingChunks || [] }));
        } catch (err) {
            setError((err as Error).message || 'متاسفانه در دریافت آخرین اخبار مشکلی پیش آمد. لطفاً بعداً دوباره تلاش کنید.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                 <h1 className="text-3xl font-bold text-white">آخرین اخبار الگوریتم اینستاگرام</h1>
                 <button onClick={() => fetchNews(true)} disabled={isLoading} className="p-2 text-slate-400 hover:text-white disabled:opacity-50 transition-colors" title="بارگذاری مجدد اخبار">
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5m-5 2a9 9 0 0014.08 5.05M20 20v-5h-5m5-2a9 9 0 00-14.08-5.05" /></svg>
                 </button>
            </div>
            <p className="text-slate-400 mb-6">این مقاله به صورت روزانه توسط هوش مصنوعی و با جستجو در وب بروزرسانی می‌شود.</p>

            {isLoading && (
                <div className="bg-slate-800 p-8 rounded-lg text-center border border-slate-700">
                    <Loader />
                    <p className="mt-4 text-slate-300">در حال جستجو و تحلیل آخرین اخبار الگوریتم...</p>
                    <p className="mt-2 text-sm text-slate-400">به دلیل جستجوی عمیق و بررسی منابع متعدد، این فرآیند ممکن است کمی طول بکشد. صبور باشید!</p>
                </div>
            )}
            
            {error && !isLoading && (
                 <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center">
                    {error}
                </div>
            )}

            {!isLoading && !error && article && (
                 <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-white prose-headings:text-violet-400 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: article }} />
                    
                    {sources.length > 0 && (
                        <div className="mt-8 border-t border-slate-700 pt-4">
                            <h3 className="text-lg font-semibold text-slate-300 mb-2 flex items-center">
                                <Icon name="document-text" className="w-5 h-5 me-2" />
                                منابع
                            </h3>
                            <ul className="list-disc list-inside space-y-1">
                                {sources.map((source, index) => (
                                    <li key={index} className="text-sm">
                                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                                            {source.web.title || source.web.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                 </div>
            )}

             {!isLoading && !error && !article && (
                 <div className="bg-slate-800 p-8 rounded-lg text-center border border-slate-700">
                    <p className="text-slate-300">مقاله‌ای برای نمایش وجود ندارد. لطفاً برای دریافت اخبار، صفحه را رفرش کنید.</p>
                </div>
            )}
        </div>
    );
};

export default AlgorithmNews;

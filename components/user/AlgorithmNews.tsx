import React, { useState, useEffect } from 'react';
import { getLatestAlgorithmNews } from '../../services/dbService';
import { AlgorithmNews as AlgorithmNewsType } from '../../types';
import { Loader } from '../common/Loader';

const AlgorithmNews: React.FC = () => {
    const [news, setNews] = useState<AlgorithmNewsType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNewsFromDB = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await getLatestAlgorithmNews();
                if (data) {
                    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
                    // Pre-format the content for rendering
                    data.content = data.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(urlPattern, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:underline break-all">${url}</a>`)
                        .replace(/\n/g, '<br />');
                    setNews(data);
                } else {
                    setError('محتوایی برای نمایش یافت نشد.');
                }
            } catch (err) {
                setError((err as Error).message);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNewsFromDB();
    }, []);

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-4">
                 <h1 className="text-3xl font-bold text-white">آخرین اخبار الگوریتم اینستاگرام</h1>
            </div>
            {news?.created_at && (
                <p className="text-slate-400 mb-6">
                    آخرین به‌روزرسانی در تاریخ: {new Date(news.created_at).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            )}

            {isLoading && (
                <div className="bg-slate-800 p-8 rounded-lg text-center border border-slate-700">
                    <Loader />
                    <p className="mt-4 text-slate-300">در حال بارگذاری آخرین اخبار...</p>
                </div>
            )}
            
            {error && !isLoading && (
                 <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center whitespace-pre-line">
                    {error}
                </div>
            )}

            {!isLoading && !error && news && (
                 <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-white prose-headings:text-violet-400 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: news.content }} />
                 </div>
            )}
        </div>
    );
};

export default AlgorithmNews;
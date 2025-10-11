import React, { useState, useEffect } from 'react';
import { getAlgorithmNews, updateAlgorithmNews } from '../../services/dbService';
import { Loader } from '../common/Loader';

const AlgorithmNewsEditor: React.FC = () => {
    const [content, setContent] = useState('');
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState('');

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const news = await getAlgorithmNews();
                if (news) {
                    setContent(news.content);
                    setLastUpdated(new Date(news.updated_at).toLocaleString('fa-IR'));
                }
            } catch (err) {
                setNotification(`خطا در بارگذاری محتوا: ${(err as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchNews();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setNotification('');
        try {
            await updateAlgorithmNews(content);
            setLastUpdated(new Date().toLocaleString('fa-IR'));
            setNotification('محتوا با موفقیت به‌روزرسانی شد.');
        } catch (err) {
            setNotification(`خطا در ذخیره‌سازی: ${(err as Error).message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setNotification(''), 4000);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center"><Loader /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">ویرایش اخبار الگوریتم</h1>
            <p className="text-slate-400 mb-6">محتوای این بخش برای تمام کاربران در صفحه «اخبار الگوریتم» نمایش داده می‌شود.</p>
            {lastUpdated && <p className="text-sm text-slate-500 mb-4">آخرین به‌روزرسانی: {lastUpdated}</p>}
            
            {notification && (
                <div className={`p-3 mb-4 rounded-lg text-sm text-center ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                    {notification}
                </div>
            )}

            <div className="space-y-4">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="محتوای اخبار را اینجا وارد کنید..."
                    className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-y"
                    disabled={isSaving}
                />
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 transition-colors"
                >
                    {isSaving ? <Loader /> : 'ذخیره و انتشار'}
                </button>
            </div>
        </div>
    );
};

export default AlgorithmNewsEditor;

import React, { useState, useEffect } from 'react';
import { getAlgorithmNewsHistory, addAlgorithmNews } from '../../services/dbService';
import { AlgorithmNews as AlgorithmNewsType } from '../../types';
import { Loader } from '../common/Loader';

const AlgorithmNewsEditor: React.FC = () => {
    const [newContent, setNewContent] = useState('');
    const [history, setHistory] = useState<AlgorithmNewsType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState('');

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const newsHistory = await getAlgorithmNewsHistory(20);
            setHistory(newsHistory);
        } catch (err) {
            setNotification(`خطا در بارگذاری تاریخچه: ${(err as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleSave = async () => {
        if (!newContent.trim()) {
            setNotification('محتوا نمی‌تواند خالی باشد.');
            return;
        }
        setIsSaving(true);
        setNotification('');
        try {
            await addAlgorithmNews(newContent);
            setNewContent('');
            setNotification('خبر جدید با موفقیت اضافه و منتشر شد.');
            await fetchHistory(); // Refresh the history list
        } catch (err) {
            let errorMessage = `خطا در ذخیره‌سازی: ${(err as Error).message}`;
            if ((err as Error).message.includes('violates row-level security policy')) {
                errorMessage = `خطای دسترسی پایگاه داده: به نظر می‌رسد پالیسی امنیتی (RLS) برای اضافه کردن خبر جدید تنظیم نشده است.

لطفاً اسکریپت SQL موجود در انتهای فایل 'services/dbService.ts' را در Supabase SQL Editor خود اجرا کنید تا دسترسی لازم ایجاد شود.`;
            }
            setNotification(errorMessage);
        } finally {
            setIsSaving(false);
            setTimeout(() => setNotification(''), 8000);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">مدیریت اخبار الگوریتم</h1>
            <p className="text-slate-400 mb-6">یک خبر جدید اضافه کنید. این خبر برای تمام کاربران نمایش داده خواهد شد.</p>
            
            {notification && (
                <div className={`p-3 mb-4 rounded-lg text-sm whitespace-pre-line ${notification.includes('خطا') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                    {notification}
                </div>
            )}

            <div className="space-y-4 bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8">
                 <h2 className="text-xl font-bold text-white mb-2">افزودن خبر جدید</h2>
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="محتوای خبر جدید را اینجا وارد کنید..."
                    className="w-full h-48 p-4 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-y"
                    disabled={isSaving}
                />
                <button
                    onClick={handleSave}
                    disabled={isSaving || !newContent.trim()}
                    className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 transition-colors"
                >
                    {isSaving ? <Loader /> : 'ذخیره و انتشار خبر جدید'}
                </button>
            </div>
            
            <div>
                 <h2 className="text-2xl font-bold text-white mb-4">تاریخچه اخبار (۲۰ مورد اخیر)</h2>
                 {isLoading ? (
                     <div className="flex justify-center py-4"><Loader /></div>
                 ) : history.length > 0 ? (
                     <div className="space-y-4">
                         {history.map(item => (
                             <div key={item.id} className="bg-slate-800 p-4 rounded-lg">
                                 <p className="text-slate-300 whitespace-pre-wrap">{item.content}</p>
                                 <p className="text-xs text-slate-500 text-left mt-2">{new Date(item.created_at).toLocaleString('fa-IR')}</p>
                             </div>
                         ))}
                     </div>
                 ) : (
                    <p className="text-center text-slate-400 py-4">تاریخچه‌ای برای نمایش وجود ندارد.</p>
                 )}
            </div>
        </div>
    );
};

export default AlgorithmNewsEditor;

import React, { useState, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import { generateStoryImageContent } from '../../services/gapGptService';
import { incrementUsage, logActivity } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useNotification } from '../../contexts/NotificationContext';

const StoryImageCreator: React.FC = () => {
    const { user, updateUser } = useUser();
    const showNotification = useNotification();
    const [text, setText] = useState('');
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [detailedError, setDetailedError] = useState<string | null>(null); // New state for error
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                setDetailedError(null); // Clear previous errors
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!user) return;
        setDetailedError(null);
        setResult('');

        if (!uploadedImage || !text.trim()) {
            showNotification('لطفاً هم عکس و هم متن را وارد کنید.', 'error');
            return;
        }

        const limit = user.image_generation_limit ?? 5;
        const usage = user.image_generation_requests ?? 0;

        if (usage >= limit) {
            showNotification('شما به سقف استفاده روزانه از این سرویس رسیده‌اید.', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const content = await generateStoryImageContent(text, uploadedImage.data, uploadedImage.mime);
            setResult(content);
            
            await incrementUsage(user.user_id, 'image_generation');
            await logActivity(user.user_id, 'استفاده از سرویس ساخت استوری تصویری');
            updateUser();
            showNotification('استوری با موفقیت طراحی شد!', 'success');

        } catch (error) {
            const msg = (error as Error).message;
            setDetailedError(msg); // Show detail on screen
            showNotification('خطا در ارتباط با هوش مصنوعی', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const formatText = (text: string) => {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
    };

    if (!user) return <Loader />;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">ساخت استوری تصویری</h1>
            <p className="text-slate-400 mb-6">
                عکس و متن خود را ارسال کنید تا هوش مصنوعی یک استوری حرفه‌ای برای شما طراحی کند.
                <span className="block text-xs mt-1 text-violet-400">باقی‌مانده امروز: {(user.image_generation_limit ?? 5) - (user.image_generation_requests ?? 0)} عدد</span>
            </p>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
                <div className="space-y-6">
                    {/* Error Display Box */}
                    {detailedError && (
                        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-4 animate-shake">
                            <div className="flex items-start gap-3">
                                <Icon name="exclamation-triangle" className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-red-200 mb-1">خطا در پردازش درخواست</h4>
                                    <p className="text-sm text-red-100 whitespace-pre-line leading-relaxed">{detailedError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Upload */}
                    <div 
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploadedImage ? 'border-violet-500 bg-violet-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        {uploadedImage ? (
                            <div className="relative">
                                <img src={uploadedImage.url} alt="Preview" className="max-h-64 rounded-lg shadow-lg" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                    <span className="text-white font-bold">تغییر عکس</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Icon name="upload" className="w-12 h-12 text-slate-400 mb-3" />
                                <span className="text-slate-300 font-medium">برای آپلود عکس کلیک کنید</span>
                            </>
                        )}
                    </div>

                    {/* Text Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">متن استوری شما</label>
                        <textarea 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="متنی که می‌خواهید در استوری نوشته شود یا توضیحی در مورد عکس..."
                            className="w-full h-32 p-4 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                        />
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={isLoading || !uploadedImage || !text.trim()}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader /> : <>
                            <Icon name="sparkles" className="w-5 h-5" />
                            طراحی استوری
                        </>}
                    </button>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className="bg-slate-800 p-6 rounded-xl border border-violet-500/50 shadow-lg animate-slide-up">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Icon name="check-circle" className="w-6 h-6 text-green-400" />
                        نتیجه طراحی
                    </h2>
                    <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white max-w-none whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg" dangerouslySetInnerHTML={{ __html: formatText(result) }} />
                </div>
            )}
        </div>
    );
};

export default StoryImageCreator;

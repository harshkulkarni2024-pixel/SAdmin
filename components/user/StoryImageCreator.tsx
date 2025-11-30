
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
    const [resultImageUrl, setResultImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [detailedError, setDetailedError] = useState<string | null>(null);
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
                setDetailedError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!user) return;
        setDetailedError(null);
        setResultImageUrl('');

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
        setLoadingStep('در حال آنالیز تصویر و طراحی سناریو...');

        try {
            // This function now returns an Image URL string
            const url = await generateStoryImageContent(text, uploadedImage.data, uploadedImage.mime);
            
            setLoadingStep('در حال نهایی‌سازی...');
            setResultImageUrl(url);
            
            await incrementUsage(user.user_id, 'image_generation');
            await logActivity(user.user_id, 'ساخت تصویر استوری با DALL-E 3');
            updateUser();
            showNotification('تصویر با موفقیت ساخته شد!', 'success');

        } catch (error) {
            const msg = (error as Error).message;
            setDetailedError(msg);
            showNotification('خطا در فرآیند ساخت تصویر', 'error');
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    };

    const handleDownload = () => {
        if (!resultImageUrl) return;
        // Open in new tab is safest for CORS images
        window.open(resultImageUrl, '_blank');
    };

    if (!user) return <Loader />;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">ساخت استوری تصویری (DALL-E 3)</h1>
            <p className="text-slate-400 mb-6">
                عکس محصول یا سوژه خود را بفرستید تا یک استوری حرفه‌ای طراحی کنیم.
                <span className="block text-xs mt-1 text-violet-400 font-mono">باقی‌مانده امروز: {(user.image_generation_limit ?? 5) - (user.image_generation_requests ?? 0)}</span>
            </p>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 shadow-xl">
                <div className="space-y-6">
                    {/* Error Display */}
                    {detailedError && (
                        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 animate-shake">
                            <div className="flex items-start gap-3">
                                <Icon name="exclamation-triangle" className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-red-200 mb-1">خطا در پردازش</h4>
                                    <p className="text-sm text-red-200/80 whitespace-pre-line leading-relaxed dir-ltr text-left font-mono text-xs">{detailedError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Image Upload */}
                        <div 
                            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all aspect-[4/5] overflow-hidden relative group ${uploadedImage ? 'border-violet-500 bg-slate-900' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            {uploadedImage ? (
                                <>
                                    <img src={uploadedImage.url} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white font-bold flex items-center gap-2"><Icon name="refresh" className="w-5 h-5"/> تغییر عکس</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-4">
                                    <Icon name="upload" className="w-12 h-12 text-slate-400 mb-3 mx-auto" />
                                    <span className="text-slate-300 font-medium block">آپلود عکس</span>
                                    <span className="text-xs text-slate-500 mt-2 block">برای شروع کلیک کنید</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Text & Action */}
                        <div className="flex flex-col gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-300 mb-2">توضیحات استوری</label>
                                <textarea 
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="مثلاً: این محصول جدید ماست، یک استوری مینیمال و شیک با تم مشکی طلایی بساز..."
                                    className="w-full h-full min-h-[150px] p-4 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-violet-500 outline-none resize-none transition-shadow"
                                />
                            </div>
                            
                            <button 
                                onClick={handleGenerate}
                                disabled={isLoading || !uploadedImage || !text.trim()}
                                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader /> : <>
                                    <Icon name="sparkles" className="w-6 h-6" />
                                    ساخت تصویر (DALL-E 3)
                                </>}
                            </button>
                        </div>
                    </div>
                    
                    {isLoading && (
                        <div className="text-center text-violet-300 text-sm animate-pulse">
                            {loadingStep}
                        </div>
                    )}
                </div>
            </div>

            {/* Result Area */}
            {resultImageUrl && (
                <div className="bg-slate-800 p-6 rounded-xl border border-violet-500/50 shadow-2xl animate-slide-up mb-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Icon name="check-circle" className="w-6 h-6 text-green-400" />
                            نتیجه نهایی
                        </h2>
                        <button 
                            onClick={handleDownload}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                        >
                            <Icon name="upload" className="w-4 h-4 rotate-180" />
                            دانلود / مشاهده کامل
                        </button>
                    </div>
                    
                    <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black flex justify-center">
                        <img 
                            src={resultImageUrl} 
                            alt="Generated Story" 
                            className="max-w-full max-h-[600px] object-contain"
                            loading="lazy"
                        />
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-3">
                        نکته: لینک تصویر موقت است (معمولاً ۱ ساعت). لطفاً آن را دانلود کنید.
                    </p>
                </div>
            )}
        </div>
    );
};

export default StoryImageCreator;

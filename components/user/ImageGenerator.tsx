
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { generateImage, editImage } from '../../services/geminiService';
import { incrementUsage, saveImageHistory, getImageHistory } from '../../services/dbService';
import { Loader } from '../common/Loader';
import { VoiceInput } from '../common/VoiceInput';
import { Icon } from '../common/Icon';

interface ImageGeneratorProps {
    user: User;
    onUserUpdate: () => void;
}

const STYLES = [
    { value: '', label: 'بدون سبک' },
    { value: 'Photorealistic', label: 'واقع‌گرایانه' },
    { value: 'Cinematic', label: 'سینمایی' },
    { value: 'Cartoon', label: 'کارتونی' },
    { value: 'Fantasy art', label: 'هنر فانتزی' },
    { value: '3D model', label: 'مدل سه‌بعدی' },
    { value: 'Watercolor', label: 'آبرنگ' },
];

const ASPECT_RATIOS = [
    { value: '1:1', label: 'مربع' },
    { value: '9:16', label: 'عمودی (استوری)' },
    { value: '16:9', label: 'افقی (پست)' },
] as const;


const ImageGenerator: React.FC<ImageGeneratorProps> = ({ user, onUserUpdate }) => {
    const [prompt, setPrompt] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [history, setHistory] = useState<{ id: number; url: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadedImage, setUploadedImage] = useState<{data: string, mime: string} | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('9:16');
    const [style, setStyle] = useState('');

    const weeklyLimit = user.image_limit ?? 35;

     useEffect(() => {
        const fetchHistory = async () => {
            const userHistory = await getImageHistory(user.user_id);
            setHistory(userHistory);
        };
        fetchHistory();
    }, [user.user_id]);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) { // 4MB limit
                setError("حجم فایل نباید بیشتر از 4 مگابایت باشد.");
                return;
            }
            try {
                const base64Data = await blobToBase64(file);
                setUploadedImage({ data: base64Data, mime: file.type });
                setError('');
            } catch (err) {
                setError("خطا در بارگذاری تصویر.");
            }
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('لطفاً برای تولید یا ویرایش عکس، یک توصیف ارائه دهید.');
            return;
        }
        
        if (user.image_requests >= weeklyLimit) {
             setError("شما به محدودیت هفتگی تولید عکس رسیده‌اید.");
             onUserUpdate();
             return;
        }

        setIsLoading(true);
        setError('');
        setCurrentImageUrl('');
        try {
            let result;
            if (uploadedImage) {
                result = await editImage(prompt, uploadedImage.data, uploadedImage.mime);
            } else {
                result = await generateImage(prompt, aspectRatio, style);
            }
            setCurrentImageUrl(result);
            await saveImageHistory(user.user_id, result);
            const updatedHistory = await getImageHistory(user.user_id);
            setHistory(updatedHistory);
            await incrementUsage(user.user_id, 'image');
            onUserUpdate();
        } catch (e: any) {
            setError(e.message || 'تولید یا ویرایش عکس با خطا مواجه شد.');
        } finally {
            setIsLoading(false);
        }
    };

    const isLimitReached = user.image_requests >= weeklyLimit;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">{uploadedImage ? 'ویرایشگر عکس' : 'تولیدکننده عکس'}</h1>
            <p className="text-sm text-slate-400 mb-6">محدودیت هفتگی: {user.image_requests} / {weeklyLimit}. {uploadedImage ? 'دستور ویرایش رو بنویس.' : 'عکسی که می‌خوای بسازی رو توصیف کن.'}</p>

             {isLimitReached && !isLoading && !currentImageUrl && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-center">
                    شما به محدودیت هفتگی تولید عکس رسیده‌اید. هفته آینده دوباره سر بزنید!
                </div>
            )}

            {!isLimitReached && (
                <div className="space-y-4">
                     <div className="mb-4">
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {uploadedImage ? (
                                    <div>
                                        <img src={`data:${uploadedImage.mime};base64,${uploadedImage.data}`} alt="Preview" className="mx-auto h-32 w-auto rounded-md" />
                                        <button onClick={() => setUploadedImage(null)} className="mt-2 text-sm text-red-400 hover:text-red-300">حذف عکس</button>
                                    </div>
                                ) : (
                                    <>
                                        <Icon name="image" className="mx-auto h-12 w-12 text-slate-500" />
                                        <p className='text-sm text-slate-300 mb-1'>یک عکس برای ویرایش آپلود کن</p>
                                        <div className="flex text-sm text-slate-400 justify-center">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-violet-400 hover:text-violet-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-violet-500 px-2">
                                                <span>انتخاب فایل</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-500">PNG, JPG, WEBP (حداکثر 4MB)</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                     {!uploadedImage && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">ابعاد عکس</label>
                                <div className="flex gap-2">
                                    {ASPECT_RATIOS.map(ratio => (
                                        <button key={ratio.value} onClick={() => setAspectRatio(ratio.value)} className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${aspectRatio === ratio.value ? 'bg-violet-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                            {ratio.label}
                                        </button>
                                    ))}
                                </div>
                             </div>
                              <div>
                                <label htmlFor="style-select" className="block text-sm font-medium text-slate-300 mb-2">سبک عکس</label>
                                <select id="style-select" value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white p-2.5 rounded-lg focus:ring-violet-500 focus:border-violet-500">
                                     {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    
                    <div className="relative">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={uploadedImage ? 'مثلا: یک کلاه تولد روی سرش بگذار' : 'مثلاً: یک فضانورد که در مریخ سوار بر اسب است'}
                            className="w-full h-24 p-4 ps-20 pe-4 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                            disabled={isLoading}
                        />
                        <VoiceInput onTranscript={setPrompt} disabled={isLoading} />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader /> : (uploadedImage ? 'ویرایش عکس' : 'تولید عکس')}
                    </button>
                </div>
            )}
            
            {error && <p className="text-red-400 mt-4 text-center whitespace-pre-line">{error}</p>}

            {isLoading && !currentImageUrl && (
                 <div className="mt-8 text-center text-slate-400">
                    <Loader />
                    <p>هوش مصنوعی سوپر ادمین آیتــــم در حال تولید عکس شما</p>
                 </div>
            )}

            {currentImageUrl && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-violet-400 mb-4 text-center">نتیجه شما ✨</h2>
                    <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <img src={currentImageUrl} alt="Generated content" className="rounded-md w-full max-w-lg mx-auto" />
                    </div>
                </div>
            )}
            
             {history.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-white mb-4">آخرین عکس‌های تولید شده</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {history.map(item => (
                            <div key={item.id} className="bg-slate-800 p-1 rounded-lg border border-slate-700">
                                <img src={item.url} alt="Generated" className="rounded-md w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageGenerator;
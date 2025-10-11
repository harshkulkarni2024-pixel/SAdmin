import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { analyzeInstagramScreenshot, generateCompetitorAnalysis } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';

interface CompetitorAnalysisProps {
    user: User;
    onUserUpdate: () => void;
}

interface AnalysisResult {
    visual: string;
    web: string;
    imageUrl: string;
    id: number;
    instagramId: string;
}

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ user, onUserUpdate }) => {
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string } | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [history, setHistory] = useState<AnalysisResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [error, setError] = useState('');

    const monthlyLimit = 30;

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(`competitor_analysis_history_${user.user_id}`);
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }
        } catch (e) {
            console.error("Could not load analysis history", e);
        }
    }, [user.user_id]);

    const saveHistory = (newResult: AnalysisResult) => {
        setHistory(prev => {
            const newHistory = [newResult, ...prev];
            if (newHistory.length > 30) {
                newHistory.pop();
            }
            try {
                localStorage.setItem(`competitor_analysis_history_${user.user_id}`, JSON.stringify(newHistory));
            } catch (e) {
                console.error("Could not save analysis history", e);
            }
            return newHistory;
        });
    }

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
            if (file.size > 4 * 1024 * 1024) {
                setError("حجم فایل نباید بیشتر از 4 مگابایت باشد.");
                return;
            }
            try {
                const base64Data = await blobToBase64(file);
                const objectUrl = URL.createObjectURL(file);
                setUploadedImage({ data: base64Data, mime: file.type, url: objectUrl });
                setAnalysisResult(null);
                setError('');
            } catch (err) {
                setError("خطا در بارگذاری تصویر.");
            }
        }
    };
    
    const handleRemoveImage = () => {
        if (uploadedImage) {
            URL.revokeObjectURL(uploadedImage.url);
        }
        setUploadedImage(null);
        setAnalysisResult(null);
        setError('');
    };

    const handleAnalyze = async () => {
        if (!uploadedImage) {
            setError('لطفاً ابتدا یک اسکرین‌شات آپلود کنید.');
            return;
        }
        if (history.length >= monthlyLimit) {
            setError(`شما به محدودیت ماهانه ${monthlyLimit} تحلیل رسیده‌اید.`);
            return;
        }

        setIsLoading(true);
        setError('');
        setAnalysisResult(null);
        setLoadingStep('هوش مصنوعی در حال تحلیل تصویر و بررسی استراتژی‌هاست...');

        try {
            const { instagramId, visualAnalysis } = await analyzeInstagramScreenshot(uploadedImage.data, uploadedImage.mime);
            const webAnalysis = await generateCompetitorAnalysis(instagramId, user.about_info || '');
            const formattedWebAnalysis = webAnalysis
                .replace(/### (.*?){#(.*?)}/g, '<h3 id="$2">$1</h3>') // Convert custom markdown headers to HTML with ID
                .replace(/\n/g, '<br />');


            const newResult = {
                visual: visualAnalysis,
                web: formattedWebAnalysis,
                imageUrl: uploadedImage.url,
                id: Date.now(),
                instagramId: instagramId,
            };
            setAnalysisResult(newResult);
            saveHistory(newResult);
            onUserUpdate();

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    };

    const remainingAnalyses = monthlyLimit - history.length;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
             <style>{`
                .analysis-content h3 {
                    background-color: #4c1d95; /* bg-violet-800 */
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    display: inline-block;
                    margin-bottom: 0.75rem;
                    font-size: 1.125rem;
                }
                 .analysis-content a {
                    color: #a78bfa; /* text-violet-400 */
                    text-decoration: none;
                }
                .analysis-content a:hover {
                    text-decoration: underline;
                }
            `}</style>
            <h1 className="text-3xl font-bold text-white mb-2">تحلیل رقبا</h1>
            <p className="text-slate-400 mb-6">یک اسکرین‌شات از پیج رقیب آپلود کنید تا هوش مصنوعی آیتـــــم استراتژی و هویت بصری آن را تحلیل کند. ({remainingAnalyses > 0 ? `${remainingAnalyses} تحلیل این ماه باقی‌مانده` : 'محدودیت ماهانه شما تمام شده است.'})</p>

            {!analysisResult && (
                <>
                <div className="bg-slate-800 p-6 rounded-lg mb-6 border border-slate-700">
                    {uploadedImage ? (
                        <div className="text-center">
                            <img src={uploadedImage.url} alt="پیش‌نمایش اسکرین‌شات" className="max-h-80 mx-auto rounded-lg border border-slate-600" />
                            <div className="flex justify-center gap-4 mt-4">
                                <button onClick={handleRemoveImage} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors">
                                    حذف عکس
                                </button>
                                <button onClick={handleAnalyze} disabled={remainingAnalyses <= 0} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors">
                                    شروع تحلیل
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center px-6 py-10 border-2 border-slate-700 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <Icon name="upload" className="mx-auto h-12 w-12 text-slate-500" />
                                <div className="flex text-sm text-slate-400 justify-center">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-violet-400 hover:text-violet-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-violet-500 px-4 py-2">
                                        <span>یک اسکرین‌شات انتخاب کنید</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500 pt-1">PNG, JPG, WEBP (حداکثر 4MB)</p>
                            </div>
                        </div>
                    )}
                </div>
                {history.length > 0 && (
                     <div className="mt-12">
                        <h2 className="text-2xl font-bold text-white mb-4">تاریخچه تحلیل‌ها</h2>
                        <div className="space-y-2">
                            {history.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setAnalysisResult(item)}
                                    className="w-full text-right bg-slate-800 p-3 rounded-lg flex justify-between items-center hover:bg-slate-700/50 transition-colors"
                                >
                                    <span className="font-semibold text-white">تحلیل پیج: {item.instagramId}</span>
                                    <span className="text-xs text-slate-400">{new Date(item.id).toLocaleDateString('fa-IR')}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                </>
            )}
            
            {error && (
                 <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center whitespace-pre-line mb-6">
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="bg-slate-800 p-8 rounded-lg text-center border border-slate-700">
                    <Loader />
                    <p className="mt-4 text-slate-300 font-semibold">در حال انجام تحلیل...</p>
                    <p className="mt-2 text-sm text-slate-400">{loadingStep}</p>
                </div>
            )}
            
            {analysisResult && (
                <div>
                    <div className="text-center mb-6">
                        <button onClick={handleRemoveImage} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors">
                            تحلیل یک پیج جدید
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                             <img src={analysisResult.imageUrl} alt="اسکرین‌شات تحلیل شده" className="rounded-lg border border-slate-600" />
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                                <h2 className="text-xl font-bold text-violet-400 mb-3">🎨 تحلیل بصری و برندینگ</h2>
                                <p className="text-slate-300 whitespace-pre-wrap">{analysisResult.visual}</p>
                            </div>
                             <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                                <h2 className="text-xl font-bold text-violet-400 mb-3">🌐 تحلیل استراتژی محتوا</h2>
                                <div className="analysis-content prose prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: analysisResult.web }} />
                             </div>
                        </div>
                    </div>
                     <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700">
                        <h3 className="text-lg font-bold text-center text-white mb-4">می‌خوای تحلیل دقیق‌تری داشته باشیم؟ 🤔</h3>
                        <p className="text-center text-slate-400 text-sm mb-4">یک اسکرین‌شات از بخش مربوطه برام بفرست تا عمیق‌تر بررسیش کنیم.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => alert('این قابلیت به زودی اضافه خواهد شد!')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-violet-600 transition-colors">تحلیل پست‌ها</button>
                            <button onClick={() => alert('این قابلیت به زودی اضافه خواهد شد!')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-violet-600 transition-colors">تحلیل استوری‌ها</button>
                            <button onClick={() => alert('این قابلیت به زودی اضافه خواهد شد!')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-violet-600 transition-colors">مقایسه با پیج خودم</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorAnalysis;
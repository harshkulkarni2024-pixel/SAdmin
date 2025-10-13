import React, { useState, useEffect, useCallback } from 'react';
import type { CompetitorAnalysisHistory } from '../../types';
// Fix: Renamed handleGeminiError to handleAiError as per the exported function name from geminiService.
import { analyzeInstagramScreenshot, generateCompetitorAnalysis, handleAiError } from '../../services/geminiService';
import * as db from '../../services/dbService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';
import { useUser } from '../../contexts/UserContext';

interface CompetitorAnalysisProps {
    // Props are now handled by context
}

interface AnalysisResult {
    visual_analysis: string;
    web_analysis: string;
    imageUrl?: string; // Image URL is temporary and not stored in DB
    id: number;
    instagram_id: string;
    created_at: string;
}

// Map DB history type to local state type
const mapHistoryToResult = (hist: CompetitorAnalysisHistory): AnalysisResult => ({
    ...hist,
    id: new Date(hist.created_at).getTime(),
});

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = () => {
    const { user, updateUser: onUserUpdate } = useUser();
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string } | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [history, setHistory] = useState<AnalysisResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [loadingStep, setLoadingStep] = useState('');
    const [error, setError] = useState('');

    const monthlyLimit = 30;

    const fetchHistory = useCallback(async () => {
      if (!user) return;
      setIsHistoryLoading(true);
      try {
        const dbHistory = await db.getCompetitorAnalysisHistory(user.user_id);
        setHistory(dbHistory.map(mapHistoryToResult));
      } catch (e) {
        setError("خطا در بارگذاری تاریخچه تحلیل‌ها.");
        console.error("Could not load analysis history", e);
      } finally {
        setIsHistoryLoading(false);
      }
    }, [user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);


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
        if (!uploadedImage || !user) {
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
        
        try {
            setLoadingStep('هوش مصنوعی در حال شناسایی پیج از روی تصویر است...');
            const { instagramId, visualAnalysis } = await analyzeInstagramScreenshot(uploadedImage.data, uploadedImage.mime);

            setLoadingStep('هوش مصنوعی در حال تحلیل استراتژی و محتوا است...');
            const webAnalysis = await generateCompetitorAnalysis(instagramId, user.about_info || '');
            const formattedWebAnalysis = webAnalysis
                .replace(/### (.*?){#(.*?)}/g, '<h3 id="$2">$1</h3>') // Convert custom markdown headers to HTML with ID
                .replace(/\n/g, '<br />');

            const newAnalysisData = {
                instagram_id: instagramId,
                visual_analysis: visualAnalysis,
                web_analysis: formattedWebAnalysis,
            };

            await db.saveCompetitorAnalysisHistory(user.user_id, newAnalysisData);
            await db.incrementUsage(user.user_id, 'competitor_analysis');

            const newResult: AnalysisResult = {
                ...newAnalysisData,
                imageUrl: uploadedImage.url,
                id: Date.now(),
                created_at: new Date().toISOString(),
            };

            setAnalysisResult(newResult);
            setHistory(prev => [newResult, ...prev].slice(0, 30));
            onUserUpdate();

        } catch (err) {
            // Fix: Renamed handleGeminiError to handleAiError to match the imported function.
            setError(handleAiError(err));
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
                                <button onClick={handleAnalyze} disabled={remainingAnalyses <= 0 || isLoading} className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors">
                                    {isLoading ? <Loader/> : 'شروع تحلیل'}
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
                {isHistoryLoading ? <div className="flex justify-center"><Loader/></div> : history.length > 0 && (
                     <div className="mt-12">
                        <h2 className="text-2xl font-bold text-white mb-4">تاریخچه تحلیل‌ها</h2>
                        <div className="space-y-2">
                            {history.map(item => (
                                <div key={item.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                                    <button
                                        onClick={() => setAnalysisResult(item)}
                                        className="text-right flex-grow"
                                    >
                                      <span className="font-semibold text-white">تحلیل پیج: </span>
                                      <a
                                          href={`https://instagram.com/${item.instagram_id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-violet-400 hover:underline font-semibold"
                                      >
                                          {item.instagram_id}
                                      </a>
                                    </button>
                                    <span className="text-xs text-slate-400 flex-shrink-0">{new Date(item.created_at).toLocaleDateString('fa-IR')}</span>
                                </div>
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
                             {analysisResult.imageUrl ? 
                                <img src={analysisResult.imageUrl} alt="اسکرین‌شات تحلیل شده" className="rounded-lg border border-slate-600" /> :
                                <div className="bg-slate-800 aspect-square flex flex-col items-center justify-center rounded-lg border border-slate-600 text-center p-4">
                                    <Icon name="image" className="w-12 h-12 text-slate-500 mb-2"/>
                                    <p className="text-sm text-slate-400">تصویر این تحلیل ذخیره نشده است.</p>
                                </div>
                             }
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                                <h2 className="text-xl font-bold text-violet-400 mb-3">🎨 تحلیل بصری و برندینگ</h2>
                                <p className="text-slate-300 whitespace-pre-wrap">{analysisResult.visual_analysis}</p>
                            </div>
                             <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                                <h2 className="text-xl font-bold text-violet-400 mb-3">🌐 تحلیل استراتژی محتوا</h2>
                                <div className="analysis-content prose prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: analysisResult.web_analysis }} />
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorAnalysis;

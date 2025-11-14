import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { CompetitorAnalysisHistory } from '../../types';
import { analyzeInstagramScreenshot, handleAiError } from '../../services/geminiService';
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
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [history, setHistory] = useState<AnalysisResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
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

    const handleAnalyze = async () => {
        if (!uploadedImage || !user) {
            setError('لطفاً ابتدا یک اسکرین‌شات از پروفایل رقیب آپلود کنید.');
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
            const { instagramId, visualAnalysis } = await analyzeInstagramScreenshot(uploadedImage.data, uploadedImage.mime);

            const webAnalysis = "در این نسخه، تحلیل فقط بر اساس اسکرین‌شات انجام می‌شود و تحلیل وب غیرفعال است.";

            const newAnalysisData = {
                instagram_id: instagramId,
                visual_analysis: visualAnalysis,
                web_analysis: webAnalysis,
            };

            await db.saveCompetitorAnalysisHistory(user.user_id, newAnalysisData);
            await db.incrementUsage(user.user_id, 'competitor_analysis');

            const newResult: AnalysisResult = {
                ...newAnalysisData,
                id: Date.now(),
                created_at: new Date().toISOString(),
            };

            setAnalysisResult(newResult);
            setHistory(prev => [newResult, ...prev].slice(0, 30));
            onUserUpdate();
            setUploadedImage(null);

        } catch (err) {
            setError(handleAiError(err));
        } finally {
            setIsLoading(false);
        }
    };
    
    const startNewAnalysis = () => {
        setAnalysisResult(null);
        setError('');
        setUploadedImage(null);
    }

    const remainingAnalyses = monthlyLimit - history.length;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">تحلیل رقبا</h1>
            <p className="text-slate-400 mb-6">یک اسکرین‌شات از پروفایل رقیب خود آپلود کنید تا هوش مصنوعی آیتـــــم آن را تحلیل کند. ({remainingAnalyses > 0 ? `${remainingAnalyses} تحلیل این ماه باقی‌مانده` : 'محدودیت ماهانه شما تمام شده است.'})</p>

            {!analysisResult && (
                <>
                <div className="bg-slate-800 p-6 rounded-lg mb-6 border border-slate-700">
                   <div className="flex flex-col items-center gap-4">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-600 rounded-lg hover:bg-slate-700/50 hover:border-violet-500 transition-colors"
                        >
                            {uploadedImage ? (
                                <img src={uploadedImage.url} alt="Preview" className="max-h-48 rounded-md" />
                            ) : (
                                <>
                                    <Icon name="upload" className="w-12 h-12 text-slate-500 mb-2" />
                                    <span className="text-white font-semibold">آپلود اسکرین‌شات پروفایل رقیب</span>
                                    <span className="text-sm text-slate-400">برای شروع، اینجا کلیک کنید</span>
                                </>
                            )}
                        </button>
                        <button onClick={handleAnalyze} disabled={remainingAnalyses <= 0 || isLoading || !uploadedImage} className="w-full px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors flex justify-center">
                            {isLoading ? <Loader/> : 'شروع تحلیل'}
                        </button>
                    </div>
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
                                      <span className="font-semibold text-white">تحلیل پیج: @{item.instagram_id}</span>
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
                    <p className="mt-4 text-slate-300 font-semibold">در حال تحلیل تصویر...</p>
                    <p className="mt-2 text-sm text-slate-400">هوش مصنوعی در حال بررسی هویت بصری، برندینگ و زیبایی‌شناسی پروفایل است.</p>
                </div>
            )}
            
            {analysisResult && (
                <div>
                    <div className="text-center mb-6">
                        <button onClick={startNewAnalysis} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors">
                            تحلیل یک پیج جدید
                        </button>
                    </div>

                    <div className="space-y-6">
                         <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                             <h2 className="text-2xl font-bold text-white mb-2">تحلیل پیج: <span className="text-violet-400">@{analysisResult.instagram_id}</span></h2>
                             <p className="text-slate-400">تحلیل شده در تاریخ: {new Date(analysisResult.created_at).toLocaleDateString('fa-IR')}</p>
                         </div>

                         <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                             <h3 className="text-xl font-bold text-violet-400 mb-2">تحلیل بصری</h3>
                             <p className="text-slate-300 whitespace-pre-wrap">{analysisResult.visual_analysis}</p>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorAnalysis;
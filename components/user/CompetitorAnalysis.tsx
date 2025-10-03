
import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { generateCompetitorAnalysis } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';

interface CompetitorAnalysisProps {
    user: User;
}

interface Report {
    date: string;
    content: string;
    sources: { web: { uri: string; title: string } }[];
}

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ user }) => {
    const [competitors, setCompetitors] = useState<string[]>([]);
    const [newCompetitor, setNewCompetitor] = useState('');
    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const getCompetitorsFromStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem(`competitors_${user.user_id}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }, [user.user_id]);

    const getReportFromStorage = useCallback(() => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem(`competitor_report_${user.user_id}_${today}`);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    }, [user.user_id]);

    useEffect(() => {
        setCompetitors(getCompetitorsFromStorage());
        setReport(getReportFromStorage());
    }, [getCompetitorsFromStorage, getReportFromStorage]);

    const handleAddCompetitor = () => {
        if (newCompetitor && !competitors.includes(newCompetitor)) {
            const updatedCompetitors = [...competitors, newCompetitor.replace(/@/g, '').trim()];
            setCompetitors(updatedCompetitors);
            localStorage.setItem(`competitors_${user.user_id}`, JSON.stringify(updatedCompetitors));
            setNewCompetitor('');
        }
    };

    const handleRemoveCompetitor = (competitorToRemove: string) => {
        const updatedCompetitors = competitors.filter(c => c !== competitorToRemove);
        setCompetitors(updatedCompetitors);
        localStorage.setItem(`competitors_${user.user_id}`, JSON.stringify(updatedCompetitors));
    };

    const handleGenerateReport = async () => {
        if (competitors.length === 0) {
            setError('لطفاً حداقل یک رقیب اضافه کنید.');
            return;
        }

        setIsLoading(true);
        setError('');
        setReport(null);
        
        try {
            const { text, groundingChunks } = await generateCompetitorAnalysis(competitors);
            const today = new Date().toISOString().split('T')[0];
            const newReport = { date: today, content: text, sources: groundingChunks || [] };
            setReport(newReport);
            localStorage.setItem(`competitor_report_${user.user_id}_${today}`, JSON.stringify(newReport));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const today = new Date().toISOString().split('T')[0];
    const hasTodayReport = report?.date === today;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">تحلیل روزانه رقبا</h1>
            <p className="text-slate-400 mb-6">آی‌دی اینستاگرام رقبای خود را اضافه کنید و یک گزارش کلی از فعالیت‌های اخیرشان دریافت کنید.</p>

            <div className="bg-slate-800 p-6 rounded-lg mb-6 border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4">لیست رقبا</h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        placeholder="آی‌دی پیج را وارد کنید (بدون @)"
                        className="flex-grow bg-slate-700 border border-slate-600 text-white p-2.5 rounded-lg focus:ring-violet-500 focus:border-violet-500"
                    />
                    <button onClick={handleAddCompetitor} className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                        افزودن
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {competitors.map(c => (
                        <div key={c} className="flex items-center gap-2 bg-slate-700 text-slate-200 px-3 py-1 rounded-full text-sm">
                            <span>{c}</span>
                            <button onClick={() => handleRemoveCompetitor(c)} className="text-slate-400 hover:text-white">
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center mb-6">
                 <button 
                    onClick={handleGenerateReport} 
                    disabled={isLoading || hasTodayReport || competitors.length === 0}
                    className="w-full max-w-sm flex justify-center items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? <Loader /> : (hasTodayReport ? '✅ گزارش امروز دریافت شده' : 'دریافت تحلیل روزانه')}
                </button>
            </div>
            
             {error && (
                 <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center whitespace-pre-line mb-6">
                    {error}
                </div>
            )}
            
            {isLoading && (
                <div className="bg-slate-800 p-8 rounded-lg text-center border border-slate-700">
                    <Loader />
                    <p className="mt-4 text-slate-300">در حال جستجو و تحلیل فعالیت رقبا...</p>
                    <p className="mt-2 text-sm text-slate-400">این فرآیند ممکن است کمی طول بکشد. هوش مصنوعی در حال بررسی منابع مختلف است.</p>
                </div>
            )}

            {report && (
                 <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                    <h2 className="text-2xl font-bold text-violet-400 mb-4">گزارش تحلیل رقبا - {new Date(report.date).toLocaleDateString('fa-IR')}</h2>
                    <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-white prose-headings:text-violet-400 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.content }} />
                    
                    {report.sources && report.sources.length > 0 && (
                        <div className="mt-8 border-t border-slate-700 pt-4">
                            <h3 className="text-lg font-semibold text-slate-300 mb-2 flex items-center">
                                <Icon name="document-text" className="w-5 h-5 me-2" />
                                منابع
                            </h3>
                            <ul className="list-disc list-inside space-y-1">
                                {report.sources.map((source, index) => (
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

        </div>
    );
};

export default CompetitorAnalysis;

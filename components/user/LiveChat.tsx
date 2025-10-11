import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../../types';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { generateChatResponseStream, handleGeminiError } from '../../services/geminiService';
import { getChatHistory, saveChatHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';

// Interface for the new state machine
type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking';

const LiveChat: React.FC = () => {
    const { user } = useUser();
    const showNotification = useNotification();
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<VoiceChatState>('idle');

    const { isListening, transcript, startListening, stopListening, error: speechError, isSupported } = useSpeechRecognition();
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // To save history on unmount/end
    const historyRef = useRef(history);
    useEffect(() => { historyRef.current = history; }, [history]);
    const hasSavedRef = React.useRef(false);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    useEffect(() => {
        if (speechError) {
            showNotification(speechError, 'error');
            setStatus('idle');
        }
    }, [speechError, showNotification]);
    
    const saveConversation = useCallback(async () => {
        if (!user || hasSavedRef.current || historyRef.current.length === 0) return;
        hasSavedRef.current = true;
        try {
            const existingHistory = await getChatHistory(user.user_id);
            await saveChatHistory(user.user_id, [...existingHistory, ...historyRef.current]);
        } catch (e) {
            console.error("Failed to save live chat history:", e);
        }
    }, [user]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            saveConversation();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            stopListening();
            window.speechSynthesis.cancel();
            saveConversation();
        };
    }, [saveConversation, stopListening]);

    const handleMicClick = () => {
        if (status === 'listening') {
            stopListening();
        } else if (status === 'idle') {
            setHistory(prev => prev.filter(msg => !msg.isInterim));
            startListening();
            setStatus('listening');
        }
    };
    
    useEffect(() => {
        if (!user) return;
        if (!isListening && transcript.trim() && status === 'listening') {
            setStatus('processing');
            const userMessage: ChatMessage = { sender: 'user', text: transcript.trim() };
            const newHistory = [...history, userMessage];
            setHistory(newHistory);
            
            let aiResponse = '';
            generateChatResponseStream(user, newHistory, { text: userMessage.text }, (chunk) => {
                aiResponse += chunk;
                setHistory(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.sender === 'ai' && lastMsg.isInterim) {
                        return [...prev.slice(0, -1), { ...lastMsg, text: aiResponse }];
                    }
                    return [...prev, { sender: 'ai', text: aiResponse, isInterim: true }];
                });
            })
            .then(() => {
                setHistory(prev => {
                     const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.sender === 'ai' && lastMsg.isInterim) {
                        const { isInterim, ...finalMsg } = lastMsg;
                        return [...prev.slice(0, -1), finalMsg];
                    }
                    return prev;
                });
                speak(aiResponse);
            })
            .catch(err => {
                const formattedError = handleGeminiError(err);
                showNotification(formattedError, 'error');
                setHistory(prev => [...prev, { sender: 'ai', text: `خطا: ${formattedError}` }]);
                setStatus('idle');
            });
        }
    }, [isListening, transcript, status, user, history, showNotification]);
    
    const speak = (text: string) => {
        if (!text.trim()) {
            setStatus('idle');
            return;
        }
        
        setStatus('speaking');
        const utterance = new SpeechSynthesisUtterance(text);
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            const persianVoice = voices.find(voice => voice.lang.startsWith('fa'));
            if (persianVoice) utterance.voice = persianVoice;
        };

        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = setVoice;
        } else {
            setVoice();
        }

        utterance.lang = 'fa-IR';
        utterance.onend = () => setStatus('idle');
        utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            showNotification("خطا در پخش صدا.", 'error');
            setStatus('idle');
        };
        window.speechSynthesis.speak(utterance);
    };

    const handleEndConversation = () => {
        stopListening();
        window.speechSynthesis.cancel();
        setStatus('idle');
        saveConversation().then(() => {
            setHistory([]);
            showNotification('گفتگو ذخیره شد.', 'success');
        });
    }

    if (!user) {
        return <Loader />;
    }

    if (!isSupported) {
        return <div className="text-center p-4 bg-red-900/50 text-red-300 rounded-lg">مرورگر شما از گفتگوی صوتی پشتیبانی نمی‌کند.</div>
    }

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-white">گفتگوی زنده با آیتــم</h1>
                <p className="text-slate-400">دکمه را فشار دهید و سوال خود را بپرسید.</p>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-4 min-h-[300px]">
                <div className="space-y-6">
                    {history.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                             {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                             <div className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
                        </div>
                    ))}
                    {isListening && transcript && (
                         <div className="flex items-start gap-3 justify-end">
                            <div className="max-w-xl p-3 rounded-lg bg-violet-600 text-white opacity-70"><p className="whitespace-pre-wrap">{transcript}</p></div>
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>
            
            <div className="p-4 rounded-2xl space-y-3">
                
                <button 
                    onClick={handleMicClick} 
                    disabled={status === 'processing' || status === 'speaking'}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed ${
                        status === 'listening' ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 
                        status === 'idle' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-600'
                    }`}
                >
                    {status === 'processing' ? <Loader /> : <Icon name={status === 'listening' ? 'stop' : 'microphone'} className="w-6 h-6" />}
                    <span>
                        {status === 'listening' ? "در حال شنیدن..." :
                         status === 'processing' ? 'در حال پردازش...' :
                         status === 'speaking' ? 'در حال صحبت...' : 
                         <div className="flex items-center gap-2">
                            <span>شروع گفتگو زنده</span>
                            <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded-md shadow-lg shadow-red-500/50">LIVE</span>
                        </div>
                        }
                    </span>
                </button>
                
                {history.length > 0 &&
                    <button onClick={handleEndConversation} className="w-full text-center py-2 text-slate-400 hover:text-white text-sm">
                        پایان گفتگو و ذخیره
                    </button>
                }
            </div>
        </div>
    );
};

export default LiveChat;
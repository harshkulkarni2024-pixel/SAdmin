import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatMessage } from '../../types';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { generateChatResponseStream, handleGeminiError } from '../../services/geminiService';
import { getChatHistory, saveChatHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';

// Interface for the new state machine
type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking';

const LiveChat: React.FC<{ user: User }> = ({ user }) => {
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<VoiceChatState>('idle');
    const [error, setError] = useState<string | null>(null);

    const { isListening, transcript, startListening, stopListening, error: speechError, isSupported } = useSpeechRecognition();
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // To save history on unmount
    const historyRef = useRef(history);
    useEffect(() => { historyRef.current = history; }, [history]);
    const hasSavedOnUnmount = React.useRef(false);

    // Effect to scroll to the latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    // Effect to handle speech recognition errors
    useEffect(() => {
        if (speechError) {
            setError(speechError);
            setStatus('idle');
        }
    }, [speechError]);
    
    // Save history on component unmount
    const saveConversation = useCallback(async () => {
        if (hasSavedOnUnmount.current || historyRef.current.length === 0) return;
        try {
            // No need to merge with old history here, as we load it initially.
            // Just append the new conversation to the existing one.
            const existingHistory = await getChatHistory(user.user_id);
            await saveChatHistory(user.user_id, [...existingHistory, ...historyRef.current]);
            hasSavedOnUnmount.current = true;
        } catch (e) {
            console.error("Failed to save live chat history:", e);
        }
    }, [user.user_id]);

    useEffect(() => {
        // We are not loading previous history to keep the live session clean.
        // It will be appended to the main chat history on save.
        setHistory([]);
        
        // Cleanup function for unmounting
        return () => {
            // Stop any ongoing TTS and save
            window.speechSynthesis.cancel();
            saveConversation();
        };
    }, [saveConversation]);

    const handleMicClick = () => {
        setError(null);
        if (status === 'listening') {
            stopListening();
            // The logic to send the message will be triggered by the useEffect watching `isListening`
        } else if (status === 'idle') {
            setHistory(prev => prev.filter(msg => !msg.isInterim)); // Clear previous interim message
            startListening();
            setStatus('listening');
        }
    };
    
    // This effect runs when speech recognition provides a final transcript
    useEffect(() => {
        if (!isListening && transcript.trim() && status === 'listening') {
            setStatus('processing');
            const userMessage: ChatMessage = { sender: 'user', text: transcript.trim() };
            const newHistory = [...history, userMessage];
            setHistory(newHistory);
            
            // Send to AI
            let aiResponse = '';
            generateChatResponseStream(user, newHistory, { text: userMessage.text }, (chunk) => {
                aiResponse += chunk;
                // We update a temporary message for streaming effect, then finalize
                setHistory(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.sender === 'ai' && lastMsg.isInterim) {
                        return [...prev.slice(0, -1), { ...lastMsg, text: aiResponse }];
                    }
                    return [...prev, { sender: 'ai', text: aiResponse, isInterim: true }];
                });
            })
            .then(() => {
                // Finalize the AI message
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
                setError(formattedError);
                setHistory(prev => [...prev, { sender: 'ai', text: `خطا: ${formattedError}` }]);
                setStatus('idle');
            });
        }
    }, [isListening, transcript, status]);
    
    const speak = (text: string) => {
        if (!text.trim()) {
            setStatus('idle');
            return;
        }
        
        setStatus('speaking');
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find a Persian voice. This needs to be done after voices are loaded.
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            const persianVoice = voices.find(voice => voice.lang.startsWith('fa'));
            if (persianVoice) {
                utterance.voice = persianVoice;
            }
        };

        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = setVoice;
        } else {
            setVoice();
        }

        utterance.lang = 'fa-IR';

        utterance.onend = () => {
            setStatus('idle');
        };
        utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            setError("خطا در پخش صدا. ممکن است مرورگر شما از صدای فارسی پشتیبانی نکند.");
            setStatus('idle');
        };
        window.speechSynthesis.speak(utterance);
    };

    const MicButton = () => {
        let icon: React.ComponentProps<typeof Icon>['name'] = 'microphone';
        let text = "صحبت کنید";
        let color = "bg-violet-600 hover:bg-violet-700";
        let disabled = false;
        
        switch (status) {
            case 'listening':
                icon = 'stop';
                text = "در حال شنیدن...";
                color = "bg-red-600 hover:bg-red-700 animate-pulse";
                break;
            case 'processing':
            case 'speaking':
                icon = 'microphone';
                text = status === 'processing' ? 'در حال پردازش...' : 'در حال صحبت...';
                color = "bg-slate-600";
                disabled = true;
                break;
        }

        return (
            <button 
                onClick={handleMicClick} 
                disabled={disabled}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3 text-white font-semibold rounded-lg transition-colors ${color} disabled:cursor-not-allowed`}
            >
                {status === 'processing' ? <Loader /> : <Icon name={icon} className="w-6 h-6" />}
                {text}
            </button>
        );
    };

    if (!isSupported) {
        return (
            <div className="text-center p-4 bg-red-900/50 text-red-300 rounded-lg">
                <h2 className="font-bold">مرورگر پشتیبانی نمی‌شود</h2>
                <p>قابلیت گفتگوی صوتی در مرورگر شما در دسترس نیست. لطفاً از آخرین نسخه گوگل کروم یا فایرفاکس استفاده کنید.</p>
            </div>
        )
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
                            <div className="max-w-xl p-3 rounded-lg bg-violet-600 text-white opacity-70">
                                <p className="whitespace-pre-wrap">{transcript}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>
            
            <div className="p-4 rounded-2xl">
                {error && <p className="text-red-400 mb-4 text-center">{error}</p>}
                <MicButton />
            </div>
        </div>
    );
};

export default LiveChat;
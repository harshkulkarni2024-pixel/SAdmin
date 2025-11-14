import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../../types';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { generateChatResponseStream, handleAiError } from '../../services/geminiService';
import { incrementUsage, getChatHistory, saveChatHistory } from '../../services/dbService';

type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking';

// --- Speech Synthesis Utility ---
const speak = (text: string, onStart: () => void, onEnd: () => void, onError: (e: SpeechSynthesisErrorEvent) => void) => {
    // Cancel any previous speech to prevent overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = (e) => {
        console.error('SpeechSynthesis Error:', e);
        onError(e);
        onEnd(); // Ensure state is reset even on error
    };

    const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const persianVoice = voices.find(v => v.lang.toLowerCase() === 'fa-ir' || v.lang.toLowerCase() === 'fa');
        
        if (persianVoice) {
            utterance.voice = persianVoice;
            utterance.lang = persianVoice.lang;
        } else {
            // Even if no specific voice is found, setting the lang is crucial.
            // The browser may have a default system voice for the language.
            utterance.lang = 'fa-IR';
        }
        
        window.speechSynthesis.speak(utterance);
    };

    // Voices may load asynchronously.
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        setVoiceAndSpeak();
    } else {
        window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
    }
};

const formatMessageText = (text: string): string => {
    if (!text) return '';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text
        .replace(urlPattern, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:underline break-all">${url}</a>`)
        .replace(/\n/g, '<br />');
};

const LiveChat: React.FC = () => {
    const { user, updateUser: onUserUpdate } = useUser();
    const showNotification = useNotification();
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<VoiceChatState>('idle');
    
    const chatEndRef = useRef<HTMLDivElement>(null);
    const { isListening, transcript, startListening, stopListening, error: speechError, isSupported } = useSpeechRecognition();
    const finalTranscriptRef = useRef('');

    // Load history on mount
    useEffect(() => {
        if (!user) return;
        getChatHistory(user.user_id).then(setHistory);
    }, [user]);

    // Scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);
    
    // Show speech recognition errors
    useEffect(() => {
        if (speechError) {
            showNotification(speechError, 'error');
            setStatus('idle');
        }
    }, [speechError, showNotification]);

    // This effect triggers the AI call when the user stops speaking.
    useEffect(() => {
        if (!isListening && status === 'listening') {
            const finalTranscript = finalTranscriptRef.current.trim();
            if (finalTranscript) {
                handleSend(finalTranscript);
            } else {
                setStatus('idle'); // No speech detected, go back to idle.
            }
        }
    // This dependency array is intentionally limited to prevent re-triggering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening, status]);
    
    // Update ref with latest transcript for the effect to use
    useEffect(() => {
        finalTranscriptRef.current = transcript;
    }, [transcript]);

    const handleSend = async (userMessageText: string) => {
        if (!user) return;
        
        const weeklyLimit = user.chat_limit ?? 150;
        if (user.chat_messages >= weeklyLimit) {
            showNotification("شما به محدودیت پیام هفتگی خود رسیده‌اید.", 'error');
            setStatus('idle');
            return;
        }

        setStatus('processing');
        const newUserMessage: ChatMessage = { sender: 'user', text: userMessageText };
        const updatedHistory = [...history, newUserMessage];
        setHistory(updatedHistory);
        
        // Add a placeholder for the AI response
        // Fix: Explicitly type the new message object to match ChatMessage['sender'] literal type.
        const placeholderMessage: ChatMessage = { sender: 'ai', text: '' };
        setHistory(prev => [...prev, placeholderMessage]);

        let aiResponseText = '';
        try {
            await generateChatResponseStream(user, updatedHistory, { text: userMessageText }, (chunk) => {
                aiResponseText += chunk;
                setHistory(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage?.sender === 'ai') {
                        return [...prev.slice(0, -1), { ...lastMessage, text: aiResponseText }];
                    }
                    return prev;
                });
            });
            
            if (aiResponseText.trim()) {
                speak(
                    aiResponseText,
                    () => setStatus('speaking'),
                    () => setStatus('idle'),
                    () => showNotification('خطا در پخش صدا. ممکن است بسته صدای فارسی روی دستگاه شما نصب نباشد.', 'error')
                );
            } else {
                 throw new Error("پاسخ خالی از هوش مصنوعی دریافت شد.");
            }

            // Fix: Explicitly type the new message object to satisfy the ChatMessage[] type expected by saveChatHistory.
            const finalAiMessage: ChatMessage = { sender: 'ai', text: aiResponseText };
            const finalHistory = [...updatedHistory, finalAiMessage];
            await saveChatHistory(user.user_id, finalHistory);
            await incrementUsage(user.user_id, 'chat');
            onUserUpdate();

        } catch (error) {
            const formattedError = handleAiError(error);
            // Fix: Explicitly type the error message object to match ChatMessage['sender'] literal type.
            const errorMessage: ChatMessage = { sender: 'ai', text: `خطا: ${formattedError}` };
            setHistory(prev => {
               // Ensure we replace the placeholder, not add a new message
               const newHistory = [...prev];
               const lastMessage = newHistory[newHistory.length - 1];
               if(lastMessage && lastMessage.sender === 'ai' && lastMessage.text === '') {
                 newHistory[newHistory.length - 1] = errorMessage;
                 return newHistory;
               }
               return [...prev, errorMessage];
            });
            setStatus('idle');
        }
    };

    const handleToggleListening = () => {
        if (!isSupported) {
            showNotification('تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.', 'error');
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            setStatus('listening');
            startListening();
        }
    };

    const endConversation = async () => {
        stopListening();
        window.speechSynthesis.cancel();
        setStatus('idle');
        showNotification('گفتگو پایان یافت.', 'info');
    };

    const renderStatusButton = () => {
        const baseClasses = "w-full flex items-center justify-center gap-3 px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed";

        switch (status) {
            case 'listening':
                return (
                    <button onClick={handleToggleListening} className={`${baseClasses} bg-red-600 hover:bg-red-700`}>
                        <Icon name="stop" className="w-6 h-6" />
                        در حال شنیدن... (برای توقف کلیک کنید)
                    </button>
                );
            case 'processing':
                return <button disabled className={`${baseClasses} bg-slate-600`}><Loader /> در حال پردازش...</button>;
            case 'speaking':
                 return <button disabled className={`${baseClasses} bg-blue-600`}><Icon name="chat" className="w-6 h-6" /> هوش مصنوعی صحبت می‌کند...</button>;
            case 'idle':
            default:
                return (
                    <button onClick={handleToggleListening} disabled={!isSupported} className={`${baseClasses} bg-violet-600 hover:bg-violet-700`}>
                        <Icon name="microphone" className="w-6 h-6" />
                         شروع گفتگو
                    </button>
                );
        }
    };

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-white">گفتگوی زنده با آیتــم</h1>
                <p className="text-slate-400">برای شروع، دکمه را فشار دهید و سوال خود را بپرسید.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-4 min-h-[300px]">
                 {history.length === 0 && status === 'idle' && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Icon name="phone-wave" className="w-16 h-16 mb-4" />
                        <p>گفتگوهای شما اینجا نمایش داده می‌شود.</p>
                    </div>
                 )}
                 <div className="space-y-6">
                    {history.map((msg, index) => (
                        msg.text.trim() && // Do not render empty AI placeholders
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }} />
                            </div>
                             {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
                        </div>
                    ))}
                    {/* Show live transcript for user */}
                    {isListening && transcript && (
                         <div className="flex items-start gap-3 justify-end">
                            <div className="max-w-xl p-3 rounded-lg bg-violet-600 text-white opacity-70"><p>{transcript}</p></div>
                             <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>
            </div>

            <div className="p-4 rounded-2xl space-y-3">
                {renderStatusButton()}
                <button onClick={endConversation} className="w-full text-center py-2 text-slate-400 hover:text-white text-sm">
                    پایان گفتگو و ذخیره
                </button>
            </div>
        </div>
    );
};

export default LiveChat;
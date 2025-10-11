import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../../types';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AI_INIT_ERROR } from '../../services/geminiService';
import { getChatHistory, saveChatHistory } from '../../services/dbService';

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

type VoiceChatState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending';

const LiveChat: React.FC = () => {
    const { user } = useUser();
    const showNotification = useNotification();
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<VoiceChatState>('idle');
    const [currentTurn, setCurrentTurn] = useState<{ user: string; ai: string }>({ user: '', ai: '' });
    
    const chatEndRef = useRef<HTMLDivElement>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTime = useRef(0);
    const sources = useRef(new Set<AudioBufferSourceNode>());

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, currentTurn]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            endConversation(false); // End conversation without saving
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startConversation = useCallback(async () => {
        if (!user) {
            showNotification('کاربر یافت نشد.', 'error');
            return;
        }

        setStatus('connecting');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.LIARA_API_KEY || '' });
            if (!process.env.LIARA_API_KEY) {
                throw new Error(AI_INIT_ERROR);
            }

            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: `You are "هوش مصنوعی آیتــــم", a friendly AI expert in Instagram content strategy. You are talking to ${user.preferred_name ? user.preferred_name + ' جان' : user.full_name}. Here's some info about their work: "${user.about_info || ''}". You must speak in a friendly, conversational, and intimate Persian tone. Your spoken responses MUST be in Persian.`,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        const inputCtx = inputAudioContextRef.current;
                        if (!inputCtx || !streamRef.current) return;
                        
                        sourceRef.current = inputCtx.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                            
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        sourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputCtx.destination);
                        setStatus('listening');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const inputText = message.serverContent?.inputTranscription?.text;
                        if (typeof inputText === 'string') {
                           setCurrentTurn(prev => ({...prev, user: inputText}));
                        }
                        const outputText = message.serverContent?.outputTranscription?.text;
                        if (outputText) {
                           setCurrentTurn(prev => ({...prev, ai: prev.ai + outputText}));
                        }

                        if (message.serverContent?.turnComplete) {
                            setCurrentTurn(currentTurnValue => {
                                if (currentTurnValue.user.trim() || currentTurnValue.ai.trim()) {
                                    setHistory(prevHistory => [
                                        ...prevHistory,
                                        { sender: 'user', text: currentTurnValue.user.trim() },
                                        { sender: 'ai', text: currentTurnValue.ai.trim() },
                                    ]);
                                }
                                // Reset for the next turn
                                return { user: '', ai: '' };
                            });
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        const outputCtx = outputAudioContextRef.current;
                        if (base64Audio && outputCtx) {
                            setStatus('speaking');
                            const currentTime = outputCtx.currentTime;
                            nextStartTime.current = Math.max(nextStartTime.current, currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                sources.current.delete(source);
                                if (sources.current.size === 0) {
                                    setStatus('listening');
                                }
                            });
                            
                            source.start(nextStartTime.current);
                            nextStartTime.current += audioBuffer.duration;
                            sources.current.add(source);
                        }
                    },
                    onclose: () => {
                       // Handled by endConversation
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        let errorMessage = 'یک خطای ناشناخته رخ داد.';
                        
                        if (e.error) {
                            errorMessage = (e.error as Error).message || JSON.stringify(e.error);
                        } else if (e.message && e.message !== 'undefined') {
                            errorMessage = e.message;
                        }

                        showNotification(`خطا در گفتگوی زنده: ${errorMessage}`, 'error');
                        endConversation(false);
                    },
                },
            });

        } catch (err) {
            showNotification(`خطا در شروع گفتگو: ${(err as Error).message}`, 'error');
            setStatus('idle');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, showNotification]);

    const endConversation = useCallback(async (shouldSave = true) => {
        if (status === 'idle' || status === 'ending') return;
        setStatus('ending');
        
        sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
        sessionPromiseRef.current = null;

        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        scriptProcessorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);

        if (shouldSave && user && history.length > 0) {
            try {
                const existingHistory = await getChatHistory(user.user_id);
                await saveChatHistory(user.user_id, [...existingHistory, ...history]);
                showNotification('گفتگو با موفقیت ذخیره شد.', 'success');
            } catch (e) {
                console.error("Failed to save live chat history:", e);
                showNotification('خطا در ذخیره گفتگو.', 'error');
            }
        }
        
        setHistory([]);
        setCurrentTurn({ user: '', ai: '' });
        setStatus('idle');
    }, [user, history, showNotification, status]);

    const renderStatusButton = () => {
        const baseClasses = "w-full flex items-center justify-center gap-3 px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed";

        switch (status) {
            case 'idle':
                return (
                    <button onClick={startConversation} className={`${baseClasses} bg-violet-600 hover:bg-violet-700`}>
                        <Icon name="microphone" className="w-6 h-6" />
                        <div className="flex items-center gap-2">
                            <span>شروع گفتگو زنده</span>
                            <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded-md shadow-lg shadow-red-500/50">LIVE</span>
                        </div>
                    </button>
                );
            case 'connecting':
                return <button disabled className={`${baseClasses} bg-slate-600`}><Loader /> در حال اتصال...</button>;
            case 'listening':
                return <button disabled className={`${baseClasses} bg-green-600 animate-pulse`}><Icon name="microphone" className="w-6 h-6" /> در حال شنیدن...</button>;
            case 'speaking':
                return <button disabled className={`${baseClasses} bg-blue-600`}><Icon name="chat" className="w-6 h-6" /> هوش مصنوعی صحبت می‌کند...</button>;
            case 'ending':
                return <button disabled className={`${baseClasses} bg-slate-600`}><Loader /> در حال پایان...</button>;
        }
    };
    
    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-white">گفتگوی زنده با آیتــم</h1>
                <p className="text-slate-400">برای شروع، دکمه را فشار دهید و سوال خود را بپرسید.</p>
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
                    {currentTurn.user && (
                        <div className="flex items-start gap-3 justify-end">
                            <div className="max-w-xl p-3 rounded-lg bg-violet-600 text-white opacity-70"><p>{currentTurn.user}</p></div>
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>
                        </div>
                    )}
                    {currentTurn.ai && (
                        <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>
                            <div className="max-w-xl p-3 rounded-lg bg-slate-700 text-slate-200 opacity-70"><p>{currentTurn.ai}</p></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>
            
            <div className="p-4 rounded-2xl space-y-3">
                {renderStatusButton()}
                {(status === 'listening' || status === 'speaking' || status === 'connecting') && (
                    <button onClick={() => endConversation()} className="w-full text-center py-2 text-slate-400 hover:text-white text-sm">
                        پایان گفتگو و ذخیره
                    </button>
                )}
            </div>
        </div>
    );
};

export default LiveChat;
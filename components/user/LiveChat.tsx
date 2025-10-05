
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../../types';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AI_INIT_ERROR, handleGeminiError } from '../../services/geminiService';
import { getChatHistory, saveChatHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { Loader } from '../common/Loader';

// Base64 and Audio decoding/encoding helpers
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

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


interface LiveChatProps {
    user: User;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

const LiveChat: React.FC<LiveChatProps> = ({ user }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sources = useRef(new Set<AudioBufferSourceNode>()).current;
    const nextStartTime = useRef(0);
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    const cleanup = () => {
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
        }
        sessionPromiseRef.current = null;
        sources.forEach(source => source.stop());
        sources.clear();
        nextStartTime.current = 0;
    };
    
    useEffect(() => {
        return () => cleanup();
    }, []);

    const startConversation = async () => {
        setConnectionState('connecting');
        setError(null);
        setTranscripts([]);
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const message = 'مرورگر شما از گفتگوی زنده پشتیبانی نمی‌کند. لطفاً از یک مرورگر مدرن (مانند Chrome یا Firefox) در یک اتصال امن (HTTPS) استفاده کنید.';
            setError(message);
            setConnectionState('error');
            return;
        }

        try {
            const apiKey = import.meta.env?.VITE_API_KEY;
            if (!apiKey) throw new Error(AI_INIT_ERROR);
            const ai = new GoogleGenAI({ apiKey });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');
                        const inputCtx = inputAudioContextRef.current!;
                        mediaStreamSourceRef.current = inputCtx.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: createBlob(inputData) });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const userMsg = currentInputTranscription.current.trim();
                            const aiMsg = currentOutputTranscription.current.trim();
                            const newMessages: ChatMessage[] = [];
                            if(userMsg) newMessages.push({ sender: 'user', text: userMsg });
                            if(aiMsg) newMessages.push({ sender: 'ai', text: aiMsg });
                            
                            if (newMessages.length > 0) {
                               setTranscripts(prev => [...prev, ...newMessages]);
                            }

                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                        }
                        
                        // Handle audio playback
                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            const outputCtx = outputAudioContextRef.current!;
                            nextStartTime.current = Math.max(nextStartTime.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => sources.delete(source));
                            source.start(nextStartTime.current);
                            nextStartTime.current += audioBuffer.duration;
                            sources.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`خطا در ارتباط: ${e.message}`);
                        setConnectionState('error');
                        cleanup();
                    },
                    onclose: (e: CloseEvent) => {
                        setConnectionState('closed');
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: `You are "Item", a friendly AI for an Instagram content creator named ${user.full_name}. Here is some info about them: ${user.about_info}. You must speak Persian. IMPORTANT: Start the conversation immediately by saying in Persian: 'سلام، من هوش مصنوعی آیتم هستم. چطور میتونم کمکتون کنم؟' and then wait for the user to speak.`,
                },
            });
            sessionPromiseRef.current = sessionPromise;
        } catch (err) {
            setError(handleGeminiError(err));
            setConnectionState('error');
            cleanup();
        }
    };

    const stopConversation = async () => {
        sessionPromiseRef.current?.then(session => session.close());
        
        if (transcripts.length > 0) {
            try {
                const existingHistory = await getChatHistory(user.user_id);
                const combinedHistory = [...existingHistory, ...transcripts];
                await saveChatHistory(user.user_id, combinedHistory);
            } catch (e) {
                console.error("Failed to save live chat history:", e);
            }
        }

        cleanup();
        setConnectionState('idle');
    };

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                <h1 className="text-3xl font-bold text-white mb-2">گفتگوی زنده (VIP)</h1>
                <p className="text-slate-400">با هوش مصنوعی آیتم به صورت صوتی و زنده صحبت کنید.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-4 min-h-[300px]">
                <div className="space-y-6">
                    {transcripts.map((msg, index) => (
                         <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <p>{msg.text}</p>
                            </div>
                            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
                        </div>
                    ))}
                    {connectionState === 'connecting' && <div className="flex justify-center"><Loader/></div>}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-2xl">
                {error && <p className="text-red-400 mb-4 whitespace-pre-line text-center">{error}</p>}
                
                {connectionState === 'idle' && (
                    <button onClick={startConversation} className="w-full px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors">
                        شروع گفتگو
                    </button>
                )}

                {connectionState === 'connecting' && (
                     <div className="flex flex-col items-center">
                         <p className="text-slate-300">در حال برقراری ارتباط...</p>
                    </div>
                )}
                
                 {connectionState === 'connected' && (
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 rounded-full border-4 border-violet-500 animate-pulse flex items-center justify-center">
                           <Icon name="phone-wave" className="w-8 h-8 text-violet-400"/>
                        </div>
                        <p className="text-slate-300 mb-4">در حال گوش دادن...</p>
                        <button onClick={stopConversation} className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                            پایان و ذخیره گفتگو
                        </button>
                    </div>
                )}

                 {(connectionState === 'error' || connectionState === 'closed') && (
                     <button onClick={startConversation} className="w-full px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors">
                        شروع مجدد گفتگو
                    </button>
                 )}
            </div>
        </div>
    );
};

export default LiveChat;
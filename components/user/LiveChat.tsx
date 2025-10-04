import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AI_INIT_ERROR, handleGeminiError } from '../../services/geminiService';
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
    const [isMuted, setIsMuted] = useState(false);
    const [isAIThinking, setIsAIThinking] = useState(false);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sources = useRef(new Set<AudioBufferSourceNode>()).current;
    const nextStartTime = useRef(0);

    const cleanup = () => {
        console.log("Cleaning up audio resources...");
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
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
         if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        sessionPromiseRef.current = null;
        sources.forEach(source => source.stop());
        sources.clear();
        nextStartTime.current = 0;
    };
    
    useEffect(() => {
        // This effect runs only on unmount to ensure resources are cleaned up.
        return () => cleanup();
    }, []);

    const startConversation = async () => {
        setConnectionState('connecting');
        setError(null);

        try {
            const apiKey = import.meta.env?.VITE_API_KEY;
            if (!apiKey) throw new Error(AI_INIT_ERROR);
            const ai = new GoogleGenAI({ apiKey });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // FIX: Cast window to `any` to allow access to the prefixed `webkitAudioContext` for older browser compatibility without causing a TypeScript error.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // FIX: Cast window to `any` to allow access to the prefixed `webkitAudioContext` for older browser compatibility without causing a TypeScript error.
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log('Session opened.');
                        setConnectionState('connected');
                        
                        const inputCtx = inputAudioContextRef.current!;
                        mediaStreamSourceRef.current = inputCtx.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        setIsAIThinking(false);
                        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64EncodedAudioString) {
                            const outputCtx = outputAudioContextRef.current!;
                            nextStartTime.current = Math.max(nextStartTime.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputCtx, 24000, 1);
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
                        console.error('Session error:', e);
                        setError(`خطا در ارتباط: ${e.message}`);
                        setConnectionState('error');
                        cleanup();
                    },
                    onclose: () => {
                        console.log('Session closed.');
                        setConnectionState('closed');
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: `You are "Item", a friendly and helpful AI assistant for an Instagram content creator named ${user.full_name}. Here is some information about them: ${user.about_info}. You must speak Persian.`,
                },
            });

            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error("Failed to start conversation:", err);
            setError(handleGeminiError(err));
            setConnectionState('error');
            cleanup();
        }
    };

    const stopConversation = () => {
        sessionPromiseRef.current?.then(session => session.close());
        cleanup();
        setConnectionState('idle');
    };

    return (
        <div className="max-w-xl mx-auto text-center animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">گفتگوی زنده (VIP)</h1>
            <p className="text-slate-400 mb-6">با هوش مصنوعی آیتم به صورت صوتی و زنده صحبت کنید.</p>
            
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div className="relative w-40 h-40 mx-auto mb-6">
                    <div className={`absolute inset-0 rounded-full border-4 border-slate-600 ${connectionState === 'connected' ? 'animate-pulse border-violet-500' : ''}`}></div>
                    <div className="absolute inset-2 rounded-full bg-slate-700 flex items-center justify-center">
                        <Icon name={connectionState === 'connected' ? 'phone-wave' : 'microphone'} className={`w-16 h-16 ${connectionState === 'connected' ? 'text-violet-400' : 'text-slate-400'}`} />
                    </div>
                </div>

                {error && <p className="text-red-400 mb-4 whitespace-pre-line">{error}</p>}

                {connectionState === 'idle' && (
                    <button onClick={startConversation} className="w-full px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors">
                        شروع گفتگو
                    </button>
                )}

                {connectionState === 'connecting' && (
                     <div className="flex flex-col items-center">
                         <Loader />
                         <p className="text-slate-300 mt-2">در حال برقراری ارتباط...</p>
                    </div>
                )}
                
                 {connectionState === 'connected' && (
                    <button onClick={stopConversation} className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                        پایان گفتگو
                    </button>
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
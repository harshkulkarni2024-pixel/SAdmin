



import React from 'react';
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
    const [connectionState, setConnectionState] = React.useState<ConnectionState>('idle');
    const [error, setError] = React.useState<string | null>(null);
    const [transcripts, setTranscripts] = React.useState<ChatMessage[]>([]);
    const [inProgressTranscript, setInProgressTranscript] = React.useState({ user: '', ai: '' });
    
    // Refs for objects that should not trigger re-renders
    const sessionPromiseRef = React.useRef<Promise<any> | null>(null);
    const audioResources = React.useRef<{
        inputCtx: AudioContext | null;
        outputCtx: AudioContext | null;
        scriptProcessor: ScriptProcessorNode | null;
        mediaSource: MediaStreamAudioSourceNode | null;
        mediaStream: MediaStream | null;
        playingSources: Set<AudioBufferSourceNode>;
    }>({ inputCtx: null, outputCtx: null, scriptProcessor: null, mediaSource: null, mediaStream: null, playingSources: new Set() });
    
    const nextAudioStartTime = React.useRef(0);

    // Refs to hold latest state for callbacks/cleanup to avoid stale closures
    const transcriptsRef = React.useRef(transcripts);
    React.useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);
    
    const inProgressTranscriptsRef = React.useRef({ user: '', ai: '' });
    const hasSavedOnUnmount = React.useRef(false);
    
    const chatEndRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts, inProgressTranscript]);
    
    const cleanupAudio = React.useCallback(() => {
        const res = audioResources.current;
        if (res.scriptProcessor) {
            res.scriptProcessor.disconnect();
            res.scriptProcessor.onaudioprocess = null;
        }
        if (res.mediaSource) res.mediaSource.disconnect();
        if (res.mediaStream) res.mediaStream.getTracks().forEach(track => track.stop());
        if (res.inputCtx && res.inputCtx.state !== 'closed') res.inputCtx.close().catch(console.error);
        if (res.outputCtx && res.outputCtx.state !== 'closed') res.outputCtx.close().catch(console.error);
        res.playingSources.forEach(source => source.stop());
        
        audioResources.current = { inputCtx: null, outputCtx: null, scriptProcessor: null, mediaSource: null, mediaStream: null, playingSources: new Set() };
        nextAudioStartTime.current = 0;
    }, []);

    const endAndSaveConversation = React.useCallback(async (isUnmounting = false) => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(() => {});
            sessionPromiseRef.current = null;
        }
        
        // Prevent saving multiple times on fast unmount/re-render
        if (isUnmounting && hasSavedOnUnmount.current) {
            cleanupAudio();
            return;
        }
        
        const finalInProgress = inProgressTranscriptsRef.current;
        const finalTranscripts = [...transcriptsRef.current];
        if (finalInProgress.user.trim()) finalTranscripts.push({ sender: 'user', text: finalInProgress.user });
        if (finalInProgress.ai.trim()) finalTranscripts.push({ sender: 'ai', text: finalInProgress.ai });

        if (finalTranscripts.length > 0) {
            try {
                const existingHistory = await getChatHistory(user.user_id);
                await saveChatHistory(user.user_id, [...existingHistory, ...finalTranscripts]);
            } catch (e) {
                console.error("Failed to save live chat history:", e);
            }
        }
        
        if(isUnmounting) hasSavedOnUnmount.current = true;
        
        cleanupAudio();
        if (!isUnmounting) {
            setConnectionState('idle');
        }
    }, [user.user_id, cleanupAudio]);

    // Cleanup effect for when the component unmounts
    React.useEffect(() => {
        return () => {
            endAndSaveConversation(true);
        };
    }, [endAndSaveConversation]);


    const startConversation = async () => {
        // Reset state for a new session
        setConnectionState('connecting');
        setError(null);
        setTranscripts([]);
        setInProgressTranscript({ user: '', ai: '' });
        inProgressTranscriptsRef.current = { user: '', ai: '' };
        hasSavedOnUnmount.current = false;
        
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('مرورگر شما از گفتگوی زنده پشتیبانی نمی‌کند. لطفاً از یک مرورگر مدرن (مانند Chrome) در یک اتصال امن (HTTPS) استفاده کنید.');
            setConnectionState('error');
            return;
        }

        try {
            const apiKey = import.meta.env?.VITE_API_KEY;
            if (!apiKey) throw new Error(AI_INIT_ERROR);
            const ai = new GoogleGenAI({ apiKey });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioResources.current.mediaStream = stream;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioResources.current.inputCtx = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioResources.current.outputCtx = outputCtx;
            
            // ROOT CAUSE FIX: Using the simplest, most stable configuration to avoid 1011 errors.
            const systemInstruction = 'You are a helpful AI assistant named Item. You must speak Persian. Greet the user and ask how you can help them with their content strategy.';

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');
                        const res = audioResources.current;
                        res.mediaSource = inputCtx.createMediaStreamSource(stream);
                        res.scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        res.scriptProcessor.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: createBlob(inputData) });
                            });
                        };
                        res.mediaSource.connect(res.scriptProcessor);
                        res.scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription?.text) {
                            inProgressTranscriptsRef.current.user = message.serverContent.inputTranscription.text;
                            setInProgressTranscript(prev => ({ ...prev, user: message.serverContent.inputTranscription.text ?? '' }));
                        }
                        if (message.serverContent?.outputTranscription?.text) {
                             const newText = message.serverContent.outputTranscription.text;
                             inProgressTranscriptsRef.current.ai += newText;
                             setInProgressTranscript(prev => ({ ...prev, ai: prev.ai + newText }));
                        }
                        if (message.serverContent?.turnComplete) {
                            const newMessages: ChatMessage[] = [];
                            const userMsg = inProgressTranscriptsRef.current.user.trim();
                            const aiMsg = inProgressTranscriptsRef.current.ai.trim();
                            if (userMsg) newMessages.push({ sender: 'user', text: userMsg });
                            if (aiMsg) newMessages.push({ sender: 'ai', text: aiMsg });
                            
                            if (newMessages.length > 0) {
                               setTranscripts(prev => [...prev, ...newMessages]);
                            }
                            
                            inProgressTranscriptsRef.current = { user: '', ai: '' };
                            setInProgressTranscript({ user: '', ai: '' });
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            const nextStart = Math.max(nextAudioStartTime.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => audioResources.current.playingSources.delete(source));
                            source.start(nextStart);
                            nextAudioStartTime.current = nextStart + audioBuffer.duration;
                            audioResources.current.playingSources.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live chat error:', e);
                        setError(`خطا در ارتباط: ${e.message || 'یک خطای ناشناخته رخ داد.'}`);
                        setConnectionState('error');
                        cleanupAudio();
                    },
                    onclose: (e: CloseEvent) => {
                        if (e.code !== 1000) { // 1000 = normal closure
                          setError(`اتصال به صورت غیرمنتظره قطع شد. کد: ${e.code}. لطفا دوباره تلاش کنید.`);
                          setConnectionState('error');
                        } else {
                          setConnectionState('closed');
                        }
                        cleanupAudio();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                },
            });
        } catch (err) {
             if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                setError('دسترسی به میکروفون رد شد. لطفاً در تنظیمات مرورگر خود دسترسی را فعال کرده و صفحه را دوباره بارگیری کنید.');
            } else {
                setError(handleGeminiError(err));
            }
            setConnectionState('error');
            cleanupAudio();
        }
    };
    
    const renderInProgress = (text: string, sender: 'user' | 'ai') => {
        if (!text) return null;
        const isUser = sender === 'user';
        return (
            <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                <div className={`max-w-xl p-3 rounded-lg opacity-70 ${isUser ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                    <p className="whitespace-pre-wrap">{text}</p>
                </div>
                {isUser && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
             <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 relative h-10">
                    <h1 className="text-2xl font-bold text-white">گفتگو زنده با آیتــم</h1>
                    {connectionState === 'connected' && (
                        <span className="text-xs text-red-400 border border-red-500 bg-red-900/50 rounded-md px-2 py-0.5 animate-pulse">
                            در حال گوش دادن...
                        </span>
                    )}
                </div>
                <p className="text-slate-400">با هوش مصنوعی آیتم به صورت صوتی و زنده صحبت کنید.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-4 min-h-[300px]">
                <div className="space-y-6">
                    {transcripts.map((msg, index) => (
                         <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
                        </div>
                    ))}
                    {renderInProgress(inProgressTranscript.user, 'user')}
                    {renderInProgress(inProgressTranscript.ai, 'ai')}
                    {connectionState === 'connecting' && <div className="flex justify-center"><Loader/></div>}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className="p-4 rounded-2xl">
                {error && <p className="text-red-400 mb-4 whitespace-pre-line text-center">{error}</p>}
                
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
                    <button onClick={() => endAndSaveConversation(false)} className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                        پایان و ذخیره گفتگو
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
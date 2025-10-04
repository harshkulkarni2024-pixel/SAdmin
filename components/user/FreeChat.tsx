import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../../types';
import { startChatSession, handleGeminiError } from '../../services/geminiService';
import { incrementUsage, getChatHistory, saveChatHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';
import { Chat } from '@google/genai';

interface FreeChatProps {
    user: User;
    onUserUpdate: () => void;
}

const FreeChat: React.FC<FreeChatProps> = ({ user, onUserUpdate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const [error, setError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initializeChat = async () => {
            try {
                const history = await getChatHistory(user.user_id);
                const formattedHistory = history.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
                    parts: [{ text: msg.text }]
                }));
                
                const session = startChatSession(user.about_info || '', formattedHistory);
                setChat(session);
                setMessages(history);

            } catch(e) {
                const errorMessage = (e as Error).message;
                console.error("Chat Initialization Error:", errorMessage);
                setError(errorMessage);
                setMessages([{ sender: 'ai', text: errorMessage }]);
            }
        };
        initializeChat();
    }, [user.about_info, user.user_id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);
    
    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${scrollHeight}px`;
        }
    }, [input]);

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

    const handleSend = async () => {
        if ((!input.trim() && !uploadedImage) || isLoading || !chat) return;
        
        const weeklyLimit = user.chat_limit ?? 150;
        if (user.chat_messages >= weeklyLimit) {
            alert("شما به محدودیت پیام هفتگی خود رسیده‌اید.");
            onUserUpdate();
            return;
        }

        const newUserMessage: ChatMessage = { sender: 'user', text: input, imageUrl: uploadedImage?.url };
        const currentMessages = [...messages, newUserMessage];
        setMessages([...currentMessages, { sender: 'ai', text: '' }]);
        const currentInput = input;
        const currentImage = uploadedImage;
        setInput('');
        setUploadedImage(null);
        setIsLoading(true);

        try {
            const promptParts: any[] = [{text: currentInput}];
            if (currentImage) {
                promptParts.push({
                    inlineData: {
                        data: currentImage.data,
                        mimeType: currentImage.mime
                    }
                });
            }

            const stream = await chat.sendMessageStream({ message: promptParts });
            let fullAiResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullAiResponse += chunkText;
                setMessages(prev => {
                    const lastIndex = prev.length - 1;
                    const updatedMessages = [...prev];
                    const lastMessage = { ...updatedMessages[lastIndex] };
                    lastMessage.text = fullAiResponse;
                    updatedMessages[lastIndex] = lastMessage;
                    return updatedMessages;
                });
            }
            await incrementUsage(user.user_id, 'chat');
            onUserUpdate();
            // Pass the message with the image URL for potential UI use, but it won't be saved to DB
            await saveChatHistory(user.user_id, [...currentMessages, { sender: 'ai', text: fullAiResponse, imageUrl: undefined }]);

        } catch (error) {
             const formattedError = handleGeminiError(error);
             setMessages(prev => {
                const lastIndex = prev.length - 1;
                const updatedMessages = [...prev];
                updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], text: formattedError };
                return updatedMessages;
            });
            await saveChatHistory(user.user_id, [...currentMessages, { sender: 'ai', text: formattedError }]);
        } finally {
            setIsLoading(false);
            if(currentImage) URL.revokeObjectURL(currentImage.url);
        }
    };

    const remainingMessages = (user.chat_limit ?? 150) - user.chat_messages;

    const renderChatContent = () => {
        if (error && messages.length <= 1) {
             return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-4"><Icon name="lock-closed" className="w-6 h-6 text-slate-500" /></div>
                    <p className="font-semibold text-white">خطای اتصال به هوش مصنوعی</p>
                    <p className="text-sm whitespace-pre-wrap">{error}</p>
                </div>
            );
        }
        
        if (messages.length === 0 && !isLoading) {
            return (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Icon name="chat" className="w-16 h-16 mb-4" />
                    <p>هر سوالی در مورد استراتژی محتوا داری از من بپرس!</p>
                 </div>
            );
        }
        
        return (
            <div className="space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                        <div
                            className={`max-w-xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                        >
                            {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded content" className="rounded-md mb-2 max-w-xs" />}
                            {msg.text ? 
                             <div className="prose prose-invert prose-p:my-0 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text }} />
                             : (isLoading && index === messages.length - 1) && 
                             (<div className="flex items-center gap-2 p-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-0"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-200"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-400"></span>
                            </div>)
                            }
                        </div>
                         {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><Icon name="user" className="w-5 h-5 text-slate-300" /></div>}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                 <h1 className="text-2xl font-bold text-white">گفتگو با هوش مصنوعی</h1>
                <p className="text-sm text-slate-400 mt-2">شما {remainingMessages > 0 ? remainingMessages : 0} پیام دیگر برای این هفته دارید.</p>
            </div>
            
            {user.is_vip && (
                 <a href="#live_chat" className="mb-4 flex items-center justify-center gap-2 w-full p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                     <Icon name="phone-wave" className="w-5 h-5 text-violet-400" />
                     <span>رفتن به گفتگوی زنده</span>
                     <span className="text-xs bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-md shadow-violet-500/50">VIP</span>
                </a>
            )}

            <div className="flex-1 overflow-y-auto bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-4">
                {renderChatContent()}
            </div>

            <div className="relative">
                {uploadedImage && (
                    <div className="absolute bottom-full left-0 mb-2 p-1 bg-slate-900/80 backdrop-blur-sm rounded-lg">
                        <img src={uploadedImage.url} alt="Preview" className="h-20 w-auto rounded" />
                        <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">&times;</button>
                    </div>
                )}
                 <div className="flex items-center gap-2">
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !uploadedImage) || remainingMessages <= 0 || !chat}
                        className="p-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                        <Icon name="send" className="w-6 h-6"/>
                    </button>
                    <div className="relative flex-1">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="پیام خود را تایپ کنید یا عکسی آپلود کنید..."
                            className="w-full pl-12 pr-24 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none overflow-y-auto max-h-48"
                            disabled={isLoading || remainingMessages <= 0 || !chat}
                        />
                         <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="absolute top-1/2 -translate-y-1/2 left-2 p-2 text-slate-400 hover:text-white" title="آپلود عکس">
                             <Icon name="upload" className="w-5 h-5" />
                        </button>
                        <VoiceInput onTranscript={setInput} disabled={isLoading || remainingMessages <= 0 || !chat} />
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default FreeChat;
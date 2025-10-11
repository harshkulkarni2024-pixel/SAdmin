import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
// Fix: Renamed handleGeminiError to handleAiError as per the exported function name from geminiService.
import { generateChatResponseStream, handleAiError } from '../../services/geminiService';
import { incrementUsage, getChatHistory, saveChatHistory, deleteChatHistory } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Loader } from '../common/Loader';
import { UserViewType } from './UserView';

interface FreeChatProps {
    setActiveView: (view: UserViewType) => void;
}

const FreeChat: React.FC<FreeChatProps> = ({ setActiveView }) => {
    const { user, updateUser: onUserUpdate } = useUser();
    const showNotification = useNotification();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setIsLoading(true);
            const history = await getChatHistory(user.user_id);
            setMessages(history);
            setIsLoading(false);
        };
        fetchHistory();
    }, [user]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);
    
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
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
        if (!user || (!input.trim() && !uploadedImage) || isLoading) return;
        
        const weeklyLimit = user.chat_limit ?? 150;
        if (user.chat_messages >= weeklyLimit) {
            showNotification("شما به محدودیت پیام هفتگی خود رسیده‌اید.", 'error');
            onUserUpdate();
            return;
        }

        const newUserMessage: ChatMessage = { sender: 'user', text: input, imageUrl: uploadedImage?.url };
        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        
        const currentInput = input;
        const currentImage = uploadedImage;
        setInput('');
        setUploadedImage(null);
        setIsLoading(true);
        
        setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

        try {
            await generateChatResponseStream(user, updatedMessages, { text: currentInput, image: currentImage ? { data: currentImage.data, mime: currentImage.mime } : undefined }, (chunk) => {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage && lastMessage.sender === 'ai') {
                        return [...prev.slice(0, -1), { ...lastMessage, text: lastMessage.text + chunk }];
                    }
                    return prev;
                });
            });

            // After stream is complete
            setIsLoading(false);
            const finalMessages = [...updatedMessages];
            // Get the final AI message from state
            const finalAiMessageText = await new Promise<string>(resolve => {
                setMessages(currentMessages => {
                    resolve(currentMessages[currentMessages.length-1].text);
                    return currentMessages;
                });
            });
            finalMessages.push({ sender: 'ai', text: finalAiMessageText, imageUrl: undefined });
            
            await incrementUsage(user.user_id, 'chat');
            onUserUpdate();
            await saveChatHistory(user.user_id, finalMessages);
            
            if (currentImage) URL.revokeObjectURL(currentImage.url);

        } catch (error) {
            // Fix: Renamed handleGeminiError to handleAiError to match the imported function.
            const formattedError = handleAiError(error);
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if(lastMessage && lastMessage.sender === 'ai'){
                   return [...prev.slice(0, -1), { ...lastMessage, text: formattedError }];
                }
                return [...prev, {sender: 'ai', text: formattedError}];
            });
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!user) return;
        if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تاریخچه گفتگو را پاک کنید؟ این عمل غیرقابل بازگشت است.')) {
            try {
                await deleteChatHistory(user.user_id);
                setMessages([]);
                showNotification('تاریخچه گفتگو با موفقیت پاک شد.', 'success');
            } catch (error) {
                showNotification('خطا در پاک کردن تاریخچه. لطفاً دوباره تلاش کنید.', 'error');
            }
        }
    }

    if (!user) {
        return <div className="flex justify-center"><Loader /></div>;
    }

    const remainingMessages = (user.chat_limit ?? 150) - user.chat_messages;

    const renderChatContent = () => {
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
                            {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded content" className="rounded-md mb-2 max-w-xs max-h-64" />}
                            {msg.text ? 
                             <div className="prose prose-invert prose-p:my-0 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
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
                 <div className="flex items-center justify-center gap-4">
                    <button onClick={handleClearHistory} className="text-slate-400 hover:text-red-400" title="پاک کردن تاریخچه گفتگو">
                        <Icon name="trash" className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold text-white">گفتگو با هوش مصنوعی</h1>
                 </div>
                <p className="text-sm text-slate-400 mt-1">شما {remainingMessages > 0 ? remainingMessages : 0} پیام دیگر برای این هفته دارید.</p>
            </div>
            
            <button onClick={() => setActiveView('live_chat')} className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-4 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/20">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span>گفتگوی زنده</span>
            </button>

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
                 <div className="flex items-end gap-2">
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !uploadedImage) || remainingMessages <= 0}
                        className="p-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end mb-1"
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
                            placeholder="پیام خود را تایپ کنید..."
                            className="w-full pr-24 pl-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none overflow-y-auto max-h-48"
                            disabled={isLoading || remainingMessages <= 0}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-white" title="آپلود عکس">
                                <Icon name="paperclip" className="w-5 h-5" />
                            </button>
                            <VoiceInput onTranscriptChange={setInput} currentValue={input} disabled={isLoading || remainingMessages <= 0} />
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default FreeChat;
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
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const [error, setError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chat) return;
        
        if (user.chat_messages >= 150) {
            alert("شما به محدودیت پیام هفتگی خود رسیده‌اید.");
            onUserUpdate();
            return;
        }

        const newUserMessage: ChatMessage = { sender: 'user', text: input };
        const currentMessages = [...messages, newUserMessage];
        setMessages([...currentMessages, { sender: 'ai', text: '' }]); // Optimistic UI for AI response
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            const stream = await chat.sendMessageStream({ message: currentInput });
            let fullAiResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullAiResponse += chunkText;
                setMessages(prev => {
                    const lastIndex = prev.length - 1;
                    const updatedMessages = [...prev];
                    const lastMessage = { ...updatedMessages[lastIndex] };
                    lastMessage.text = fullAiResponse; // Update with the full response so far
                    updatedMessages[lastIndex] = lastMessage;
                    return updatedMessages;
                });
            }
            await incrementUsage(user.user_id, 'chat');
            onUserUpdate();
            await saveChatHistory(user.user_id, [...currentMessages, { sender: 'ai', text: fullAiResponse }]);

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
        }
    };

    const remainingMessages = 150 - user.chat_messages;

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
        
        if (messages.length === 0) {
            return (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Icon name="chat" className="w-16 h-16 mb-4" />
                    <p>هر سوالی در مورد استراتژی محتوا داری از من بپرس!</p>
                 </div>
            );
        }
        
        return (
            <div className="space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0"><Icon name="dashboard" className="w-5 h-5 text-white" /></div>}
                        <div
                            className={`max-w-md p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-violet-700 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}
                        >
                            {msg.text ? 
                             <div className="prose prose-invert prose-p:my-0 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text }} />
                             : (isLoading && index === messages.length - 1) && 
                             (<div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-0"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-200"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-400"></span>
                            </div>)
                            }
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col max-w-3xl mx-auto animate-fade-in">
            <div className="text-center mb-4">
                 <h1 className="text-3xl font-bold text-white">
                    گفتگو با هوش مصنوعی
                    <span className="block text-xl font-normal text-slate-400 mt-1">سوپر ادمین آیتم</span>
                </h1>
                <p className="text-sm text-slate-400 mt-2">شما {remainingMessages > 0 ? remainingMessages : 0} پیام دیگر برای این هفته دارید.</p>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-800 p-4 rounded-lg border border-slate-700 mb-4">
                {renderChatContent()}
            </div>
            <div className="flex items-center gap-2">
                 <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || remainingMessages <= 0 || !chat}
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
                        placeholder="پیام خود را تایپ کنید..."
                        className="w-full pl-4 pr-24 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none overflow-y-auto max-h-32"
                        disabled={isLoading || remainingMessages <= 0 || !chat}
                    />
                    <VoiceInput onTranscript={setInput} disabled={isLoading || remainingMessages <= 0 || !chat} />
                </div>
            </div>
        </div>
    );
};

export default FreeChat;
import React, { useState } from 'react';
import { getAllUsers, addBroadcast } from '../../services/dbService';
import { Loader } from '../common/Loader';
import { VoiceInput } from '../common/VoiceInput';

const Broadcast: React.FC = () => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [feedback, setFeedback] = useState('');

    const handleSend = async () => {
        if (!message.trim()) {
            setFeedback('پیام نمی‌تواند خالی باشد.');
            return;
        }

        setIsSending(true);
        try {
            await addBroadcast(message);
            const users = await getAllUsers();
            setFeedback(`پیام با موفقیت برای ${users.length} کاربر ارسال شد.`);
            setMessage('');
        } catch (e) {
            setFeedback('خطایی در ارسال پیام رخ داد.');
            console.error(e);
        } finally {
            setIsSending(false);
            setTimeout(() => setFeedback(''), 5000);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">ارسال اطلاعیه</h1>
            <p className="text-slate-400 mb-6">یک پیام برای تمام کاربران تایید شده ارسال کنید.</p>

            <div className="space-y-4">
                <div className="relative">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="پیام شما اینجا..."
                        className="w-full h-40 p-4 pe-24 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                        disabled={isSending}
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 right-3">
                        <VoiceInput onTranscriptChange={setMessage} currentValue={message} disabled={isSending} />
                    </div>
                </div>
                <button
                    onClick={handleSend}
                    disabled={isSending || !message.trim()}
                    className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                    {isSending ? <Loader /> : 'ارسال اطلاعیه'}
                </button>
                {feedback && <p className="text-center text-green-400 mt-4">{feedback}</p>}
            </div>
        </div>
    );
};

export default Broadcast;
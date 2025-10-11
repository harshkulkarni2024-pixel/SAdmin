
import React, { useState } from 'react';
import { addIdeaForUser } from '../../services/dbService';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';
import { useUser } from '../../contexts/UserContext';
import { Loader } from '../common/Loader';

interface PostIdeaProps {
  setActiveView: (view: 'dashboard' | 'post_scenario') => void;
}

const PostIdea: React.FC<PostIdeaProps> = ({ setActiveView }) => {
  const { user } = useUser();
  const [idea, setIdea] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user || !idea.trim()) return;
    await addIdeaForUser(user.user_id, idea);
    setIsSubmitted(true);
    setIdea('');
  };
  
  if (!user) {
    return <Loader />;
  }
  
  if (isSubmitted) {
      return (
          <div className="max-w-2xl mx-auto text-center bg-slate-800 p-8 rounded-lg animate-fade-in">
              <Icon name="idea" className="mx-auto w-16 h-16 text-green-400 mb-4" />
              <h2 className="text-2xl font-bold text-white">ایده ثبت شد!</h2>
              <p className="text-slate-400 mt-2 mb-6">ممنون از مشارکت شما! ادمین به زودی ایده شما را بررسی خواهد کرد.</p>
              <button onClick={() => setActiveView('post_scenario')} className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  بازگشت به سناریوهای پست
              </button>
          </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-white mb-2">ارسال ایده پست</h1>
      <p className="text-slate-400 mb-6">ایده‌ای برای محتوای بعدی داری؟ اینجا برای مدیر ارسالش کن تا بررسی کنه.</p>
      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="ایده خود را اینجا بنویسید..."
            className="w-full h-32 p-4 pb-14 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
          />
          <div className="absolute bottom-3 left-3">
            <VoiceInput onTranscriptChange={setIdea} currentValue={idea} />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!idea.trim()}
          className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          ارسال ایده
        </button>
      </div>
    </div>
  );
};

export default PostIdea;
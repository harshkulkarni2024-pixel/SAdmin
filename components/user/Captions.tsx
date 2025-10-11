import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User, Caption } from '../../types';
import * as db from '../../services/dbService';
import { generateCaption, AI_INIT_ERROR } from '../../services/geminiService';
import { Loader } from '../common/Loader';
import { Icon } from '../common/Icon';
import { VoiceInput } from '../common/VoiceInput';

interface CaptionsProps {
  user: User;
  onUserUpdate: () => void;
}

const Captions: React.FC<CaptionsProps> = ({ user, onUserUpdate }) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<Caption | null>(null);
  
  // State for regenerating existing captions
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newCaption, setNewCaption] = useState<string | null>(null);

  // State for generating new caption from idea
  const [idea, setIdea] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ data: string; mime: string; url: string; } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingFromIdea, setIsGeneratingFromIdea] = useState(false);
  const [generatedCaptionFromIdea, setGeneratedCaptionFromIdea] = useState('');
  const [generationError, setGenerationError] = useState('');
  
  const dailyLimit = user.caption_idea_limit ?? 2;

  const refreshCaptions = useCallback(async () => {
    const userCaptions = await db.getCaptionsForUser(user.user_id);
    setCaptions(userCaptions);
  }, [user.user_id]);

  useEffect(() => {
    refreshCaptions();
  }, [refreshCaptions]);

  const handleSelectCaption = (caption: Caption) => {
    setSelectedCaption(caption);
    setNewCaption(null); // Reset when selecting a new caption
  };
  
  const handleRegenerate = async () => {
      if (!selectedCaption) return;
      setIsRegenerating(true);
      setNewCaption('');
      try {
          const fullResponse = await generateCaption(user.about_info || '', selectedCaption.original_scenario_content);
          if (fullResponse && fullResponse.includes(AI_INIT_ERROR)) throw new Error(AI_INIT_ERROR);
          if (!fullResponse || !fullResponse.trim()) {
              throw new Error("پاسخ خالی از هوش مصنوعی دریافت شد. لطفاً دوباره تلاش کنید.");
          }
          setNewCaption(fullResponse);
      } catch (error) {
          console.error("Failed to regenerate caption", error);
          const errorMessage = (error as Error).message;
          setNewCaption(`متاسفانه، در تولید کپشن جدید خطایی رخ داد: ${errorMessage}`);
      } finally {
          setIsRegenerating(false);
      }
  };

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

  const handleGenerateFromIdea = async () => {
    if (!idea.trim() && !uploadedImage) {
        setGenerationError('لطفاً موضوع ویدیو را وارد کنید یا یک عکس آپلود کنید.');
        return;
    }
    if (user.caption_idea_requests >= dailyLimit) {
        setGenerationError("شما به محدودیت روزانه تولید کپشن از ایده رسیده‌اید.");
        return;
    }
    
    setIsGeneratingFromIdea(true);
    setGenerationError('');
    setGeneratedCaptionFromIdea('');
    const currentImage = uploadedImage;
    
    try {
        const fullResponse = await generateCaption(user.about_info || '', idea, currentImage ?? undefined);
        if (fullResponse && fullResponse.includes(AI_INIT_ERROR)) throw new Error(AI_INIT_ERROR);
        
        if (fullResponse && fullResponse.trim()) {
            setGeneratedCaptionFromIdea(fullResponse);
            await db.addCaption(user.user_id, `کپشن از ایده: ${idea.substring(0, 20)}...`, fullResponse, idea);
            await db.incrementUsage(user.user_id, 'caption_idea');
            onUserUpdate();
            refreshCaptions();
            setIdea(''); // Clear input on success
            setUploadedImage(null); // Clear image
        } else {
            throw new Error("پاسخ خالی از هوش مصنوعی دریافت شد.");
        }

    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error("Failed to generate caption from idea", error);
        setGenerationError(`خطا: ${errorMessage}`);
    } finally {
        setIsGeneratingFromIdea(false);
        if (currentImage) URL.revokeObjectURL(currentImage.url);
    }
  };


  if (selectedCaption) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <button onClick={() => setSelectedCaption(null)} className="flex items-center text-violet-400 hover:text-violet-300 mb-4">
          <Icon name="back" className="w-5 h-5 ms-2" />
          بازگشت به لیست کپشن‌ها
        </button>
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-white">{selectedCaption.title}</h2>
          <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap mb-6" dangerouslySetInnerHTML={{ __html: selectedCaption.content }} />

          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-full flex justify-center items-center bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-violet-600 disabled:bg-slate-600 transition-colors"
          >
            {isRegenerating ? <Loader/> : '🔄 یک پیشنهاد دیگر بگیر'}
          </button>
          
           {newCaption !== null && (
               <div className="mt-6 border-t border-slate-700 pt-6">
                   <h3 className="text-xl font-bold text-violet-400 mb-2">پیشنهاد جدید:</h3>
                    <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: newCaption }} />
               </div>
           )}
        </div>
      </div>
    );
  }

  const isLimitReached = user.caption_idea_requests >= dailyLimit;

  return (
    <div className="animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">تولید کپشن</h1>
        <p className="text-slate-400 mb-6">از ایده‌های خود کپشن‌های حرفه‌ای بسازید یا کپشن‌های قبلی را مشاهده کنید.</p>
        
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-2">تولید کپشن جدید از ایده</h2>
            <p className="text-sm text-slate-400 mb-4">محدودیت روزانه: {user.caption_idea_requests} / {dailyLimit}</p>

            {isLimitReached ? (
                <div className="text-center text-yellow-400 bg-yellow-900/50 p-4 rounded-lg">
                    شما به سقف استفاده روزانه از این قابلیت رسیده‌اید.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative">
                         {uploadedImage && (
                            <div className="absolute top-2 left-2 p-1 bg-slate-900/80 backdrop-blur-sm rounded-lg z-10">
                                <img src={uploadedImage.url} alt="Preview" className="h-12 w-auto rounded" />
                                <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">&times;</button>
                            </div>
                        )}
                        <textarea
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="موضوع ویدیو، ایده خام یا توضیحات تصویر خود را اینجا بنویسید..."
                            className="w-full h-24 p-4 pe-32 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                            disabled={isGeneratingFromIdea}
                        />
                         <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center">
                            <VoiceInput onTranscriptChange={setIdea} currentValue={idea} disabled={isGeneratingFromIdea} />
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-white" title="آپلود عکس" disabled={isGeneratingFromIdea}>
                                <Icon name="paperclip" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateFromIdea}
                        disabled={(!idea.trim() && !uploadedImage) || isGeneratingFromIdea}
                        className="w-full flex justify-center items-center px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isGeneratingFromIdea ? <Loader /> : 'تولید کپشن'}
                    </button>
                </div>
            )}
            {generationError && <p className="text-red-400 mt-4 text-center">{generationError}</p>}
            {generatedCaptionFromIdea && (
                <div className="mt-6 border-t border-slate-700 pt-6">
                    <h3 className="text-xl font-bold text-violet-400 mb-2">کپشن تولید شده:</h3>
                    <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap bg-slate-900/50 p-4 rounded-md" dangerouslySetInnerHTML={{ __html: generatedCaptionFromIdea }} />
                </div>
            )}
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">کپشن‌های ذخیره شده</h2>
        <p className="text-slate-400 mb-6">این‌ها کپشن‌هایی هستن که از سناریوهای ضبط‌شده شما تولید شدن.</p>
        {captions.length === 0 ? (
          <div className="text-center bg-slate-800 p-8 rounded-lg">
            <Icon name="caption" className="mx-auto w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-300">هنوز کپشنی اینجا نیست.</p>
            <p className="text-sm text-slate-500">وقتی یک «سناریو پست» را به عنوان ضبط شده علامت بزنید، یک کپشن اینجا ظاهر می‌شود!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {captions.map(caption => (
              <div key={caption.id} className="bg-slate-800 p-5 rounded-lg flex flex-col justify-between shadow-lg hover:shadow-violet-500/20 transition-shadow">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 truncate">{caption.title}</h3>
                  <p className="text-slate-400 line-clamp-4" dangerouslySetInnerHTML={{__html: caption.content}} />
                </div>
                <button onClick={() => handleSelectCaption(caption)} className="mt-4 w-full bg-slate-700 text-white py-2 px-4 rounded-lg hover:bg-violet-600 transition-colors">
                  مشاهده و دریافت پیشنهاد جدید
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Captions;
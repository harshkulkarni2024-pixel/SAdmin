import React, { useEffect, useRef } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { Icon } from './Icon';

interface VoiceInputProps {
  onTranscriptChange: (transcript: string) => void;
  currentValue: string;
  disabled?: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscriptChange, currentValue, disabled = false }) => {
  const { isListening, transcript, startListening, stopListening, error, isSupported } = useSpeechRecognition();
  
  // Use a ref for the transcript to avoid triggering re-renders on every character
  const finalTranscript = useRef('');
  
  useEffect(() => {
    finalTranscript.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (error) {
        console.warn(`Voice input error: ${error}`);
    }
  }, [error]);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      // Append the final transcript when listening is manually stopped
      if (finalTranscript.current) {
        onTranscriptChange((currentValue.trim() ? currentValue + ' ' : '') + finalTranscript.current);
      }
    } else {
      startListening();
    }
  }

  // Effect to append transcript when recognition ends naturally (e.g., on pause)
  useEffect(() => {
    if (!isListening && transcript) {
      onTranscriptChange((currentValue.trim() ? currentValue + ' ' : '') + transcript);
    }
  }, [isListening]);


  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button" // Prevent form submission
      onClick={handleToggleListening}
      disabled={disabled}
      className={`absolute top-1/2 -translate-y-1/2 right-3 flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
      }`}
      title={isListening ? 'توقف ضبط' : 'شروع ورودی صوتی'}
    >
      <Icon name={isListening ? 'stop' : 'microphone'} className="w-4 h-4" />
      <span>{isListening ? 'توقف' : 'وویس'}</span>
    </button>
  );
};
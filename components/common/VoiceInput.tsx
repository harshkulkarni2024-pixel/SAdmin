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
  const initialValueRef = useRef('');

  const handleToggleListening = () => {
    if (error) {
      alert(error);
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      initialValueRef.current = currentValue; // Capture text before starting
      startListening();
    }
  };

  // Effect to provide real-time transcription updates
  useEffect(() => {
    if (isListening) {
      // Always base the update on the initial value + current transcript to prevent duplication.
      const newText = (initialValueRef.current.trim() ? initialValueRef.current + ' ' : '') + transcript;
      onTranscriptChange(newText);
    }
  }, [transcript, isListening, onTranscriptChange]);


  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button" // Prevent form submission
      onClick={handleToggleListening}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${
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
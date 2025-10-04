import React, { useEffect, useRef } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { Icon } from './Icon';

interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, disabled = false }) => {
  const { isListening, transcript, startListening, stopListening, isSupported } = useSpeechRecognition();
  
  // Use a ref to hold the callback to prevent the effect from re-running unnecessarily
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    // Only call the transcript update when the transcript itself changes.
    // This prevents stale closures and unnecessary re-renders.
    onTranscriptRef.current(transcript);
  }, [transcript]);


  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button" // Prevent form submission
      onClick={isListening ? stopListening : startListening}
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
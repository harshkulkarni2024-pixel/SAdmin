import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

const getSpeechRecognition = (): SpeechRecognitionStatic | undefined => {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
};

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = !!getSpeechRecognition();

  // This effect sets up and tears down the recognition object.
  useEffect(() => {
    if (!isSupported) {
      setError("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.");
      return;
    }

    if (!window.isSecureContext) {
        setError("برای استفاده از ورودی صوتی، برنامه باید روی یک اتصال امن (HTTPS) اجرا شود.");
        return;
    }

    const SpeechRecognition = getSpeechRecognition()!;
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;

    rec.continuous = true;
    rec.lang = 'fa-IR';
    rec.interimResults = true;

    rec.onstart = () => {
      setIsListening(true);
    };
    
    rec.onend = () => {
      setIsListening(false);
    };
    
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = `خطای نامشخص: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = 'دسترسی به میکروفون داده نشد. لطفاً در تنظیمات مرورگر دسترسی را فعال کنید.';
      } else if (event.error === 'no-speech') {
          return; // Not a fatal error, onend will handle state.
      } else if (event.error === 'network') {
          errorMessage = 'خطای شبکه. برای استفاده از تشخیص گفتار به اینترنت متصل باشید.';
      }
      setError(errorMessage);
      setIsListening(false); // Ensure listening state is false on error.
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild the full transcript from the results list on every event.
      // This is the most robust way to handle continuous recognition and prevents jumbled/repeated text.
      const fullTranscript = Array.from(event.results)
        .map(result => result[0]) // Get the most confident alternative
        .map(alternative => alternative.transcript)
        .join(''); // Concatenate all parts. This is correct for this API pattern.
      setTranscript(fullTranscript);
    };
    
    // Cleanup on unmount
    return () => {
      rec.abort();
    };
  }, [isSupported]);
  
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript(''); // Clear transcript for the new session
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition error on start:", err);
      }
    }
  }, [isListening]);
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Speech recognition error on stop:", err);
      }
    }
  }, [isListening]);

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};

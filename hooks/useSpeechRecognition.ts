
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

  useEffect(() => {
    if (!isSupported) {
      setError("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.");
      return;
    }

    // Add explicit check for secure context. Many browsers require HTTPS for this API.
    if (!window.isSecureContext) {
        setError("برای استفاده از ورودی صوتی، برنامه باید روی یک اتصال امن (HTTPS) اجرا شود. این یک الزام امنیتی مرورگر برای حفظ حریم خصوصی شماست.");
        return;
    }

    const SpeechRecognition = getSpeechRecognition()!;
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    
    rec.continuous = true; // Keep listening until manually stopped.
    rec.lang = 'fa-IR';
    rec.interimResults = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const fullTranscript = Array.from(event.results)
        .map(result => result[0])
        .map(alternative => alternative.transcript)
        .join('');
      // Replace the keyword "اسپیس" with a newline character for formatting.
      const processedTranscript = fullTranscript.replace(/اسپیس/g, '\n');
      setTranscript(processedTranscript);
    };
    
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = event.error;
      if (event.error === 'not-allowed') {
          errorMessage = 'دسترسی به میکروفون رد شد. لطفاً در تنظیمات مرورگر خود دسترسی را فعال کنید.';
      } else if (event.error === 'no-speech') {
          // This error is frequent and can be ignored silently.
          setIsListening(false);
          return;
      } else if (event.error === 'network') {
          errorMessage = 'خطای شبکه. برای استفاده از تشخیص گفتار به اینترنت متصل باشید.';
      } else if (event.error === 'service-not-allowed') {
          errorMessage = 'سرویس تشخیص گفتار مجاز نیست. این مشکل معمولاً به دلیل اجرای برنامه روی اتصال غیرامن (HTTP) به جای HTTPS رخ می‌دهد.';
      }
      setError(errorMessage);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };
    
    return () => {
      if (recognitionRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
      }
    };
  }, [isSupported]);
  
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !isListening) {
      setTranscript(''); // Clear previous transcript before starting a new recognition session
      try {
        recognition.start();
        setIsListening(true);
        setError(null);
      } catch (e) {
        console.error("Speech recognition could not start.", e);
        setError("Could not start speech recognition.");
        setIsListening(false);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};
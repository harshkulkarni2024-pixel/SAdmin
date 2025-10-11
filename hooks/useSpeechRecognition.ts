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
  const manualStopRef = useRef(false);
  
  const isSupported = !!getSpeechRecognition();

  useEffect(() => {
    if (!isSupported) {
      setError("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.");
      return;
    }

    if (!window.isSecureContext) {
        setError("برای استفاده از ورودی صوتی، برنامه باید روی یک اتصال امن (HTTPS) اجرا شود. این یک الزام امنیتی مرورگر برای حفظ حریم خصوصی شماست.");
        return;
    }

    const SpeechRecognition = getSpeechRecognition()!;
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    
    rec.continuous = true;
    rec.lang = 'fa-IR';
    rec.interimResults = true;

    rec.onstart = () => {
      setTranscript(''); // Clear transcript only on start
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const fullTranscript = finalTranscript + interimTranscript;
      setTranscript(fullTranscript);
    };
    
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage: string = event.error;
      if (event.error === 'not-allowed') {
          errorMessage = 'دسترسی به میکروفون رد شد. لطفاً در تنظیمات مرورگر خود دسترسی را فعال کنید.';
      } else if (event.error === 'no-speech') {
          // This can happen if the user stops talking. We'll let onend handle it.
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
      if (manualStopRef.current) {
        // If stopped manually, just update state
        setIsListening(false);
        manualStopRef.current = false;
      } else if (isListening) {
        // If browser stopped it (e.g., timeout), restart it to keep listening
        try {
          rec.start();
        } catch(e) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };
    
    return () => {
      if (recognitionRef.current) {
          manualStopRef.current = true; // Ensure it doesn't auto-restart on unmount
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
      }
    };
  }, [isSupported, isListening]);
  
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !isListening) {
      try {
        manualStopRef.current = false;
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
      manualStopRef.current = true;
      recognition.stop();
      // onend will handle setting isListening to false
    }
  }, [isListening]);

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};
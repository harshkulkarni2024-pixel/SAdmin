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

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      // stop() is async, it will trigger the 'onend' event which sets isListening to false
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript(''); // Clear previous transcript
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        // This can happen if start() is called while it's already running on some browsers.
        console.error("Speech recognition error on start:", err);
        setError("خطا در شروع ضبط صدا.");
        // Attempt to reset state
        stopListening();
      }
    }
  }, [isListening, stopListening]);

  // This effect sets up the recognition object and its event listeners once.
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

    // State is controlled by the API's own events for reliability.
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage: string = `خطای نامشخص: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = 'دسترسی به میکروفون داده نشد. لطفاً در تنظیمات مرورگر دسترسی را فعال کنید و صفحه را رفرش کنید.';
      } else if (event.error === 'no-speech') {
          // This is not a fatal error. The browser automatically stops recognition.
          // The `onend` event will fire and correctly update the state.
          return; 
      } else if (event.error === 'network') {
          errorMessage = 'خطای شبکه. برای استفاده از تشخیص گفتار به اینترنت متصل باشید.';
      }
      setError(errorMessage);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild the full transcript from the results list on every event.
      // This is the most robust way to handle continuous recognition and prevents jumbled/repeated text.
      const transcriptArr = Array.from(event.results);
      const combinedTranscript = transcriptArr
        .map(result => result[0]) // Get the most confident alternative
        .map(alternative => alternative.transcript)
        .join('');
      setTranscript(combinedTranscript);
    };
    
    // Cleanup when the component unmounts
    return () => {
      if (recognitionRef.current) {
          recognitionRef.current.abort(); // Forcefully stop and release microphone
      }
    };
  }, [isSupported]);
  

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};

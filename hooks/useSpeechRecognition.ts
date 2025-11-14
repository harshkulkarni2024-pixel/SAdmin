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

  // Setup and teardown for the recognition object
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
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.lang = 'fa-IR';
    recognition.interimResults = true;

    // State is driven by the API's events for robustness
    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = `خطای نامشخص: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        errorMessage = 'دسترسی به میکروفون داده نشد. لطفاً در تنظیمات مرورگر دسترسی را فعال کنید.';
      } else if (event.error === 'network') {
        errorMessage = 'خطای شبکه. برای استفاده از تشخیص گفتار به اینترنت متصل باشید.';
      } else if (event.error === 'no-speech') {
        // This is a common occurrence, not a fatal error. 'onend' will fire.
        return;
      }
      setError(errorMessage);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild the full transcript from the results list on every event.
      // This is the most robust way to handle continuous recognition and prevents jumbled/repeated text.
      const fullTranscript = Array.from(event.results)
        .map(result => result[0]) // Get the most confident alternative
        .map(alternative => alternative.transcript)
        .join('');
      setTranscript(fullTranscript);
    };

    // Cleanup on unmount
    return () => {
      recognition.abort();
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript(''); // Clear transcript ONLY when starting a new session
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        // This can happen if start() is called again before the 'starting' state has resolved.
        // It's not fatal as the onstart event will correctly set the state.
        console.error("Speech recognition error on start:", err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        // The 'onend' event will fire and update the isListening state.
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Speech recognition error on stop:", err);
      }
    }
  }, [isListening]);

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};

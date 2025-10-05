
import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for the Web Speech API, which are not standard in all TypeScript environments.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

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
  const listeningRef = useRef(false);
  
  const isSupported = !!getSpeechRecognition();

  useEffect(() => {
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = getSpeechRecognition()!;
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    
    rec.continuous = true;
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
          // This error is frequent when continuous mode times out. We'll handle restart in onend.
          return;
      } else if (event.error === 'network') {
          errorMessage = 'خطای شبکه. برای استفاده از تشخیص گفتار به اینترنت متصل باشید.';
      } else if (event.error === 'service-not-allowed') {
          errorMessage = 'سرویس تشخیص گفتار توسط مرورگر یا سیستم شما مجاز نیست.';
      }
      setError(errorMessage);
      setIsListening(false);
      listeningRef.current = false;
    };

    rec.onend = () => {
      // If the recognition service stops on its own (e.g., due to silence),
      // and we still want to be listening, restart it.
      if (listeningRef.current) {
        try {
          recognitionRef.current?.start();
        } catch (e) {
            // This can happen if the page is being unloaded, etc.
            console.error("Could not restart speech recognition", e);
            setIsListening(false);
            listeningRef.current = false;
        }
      } else {
         setIsListening(false);
      }
    };
    
    return () => {
      if (recognitionRef.current) {
          listeningRef.current = false;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
      }
    };
  }, [isSupported]);
  
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && !listeningRef.current) {
      setTranscript('');
      try {
        listeningRef.current = true;
        recognition.start();
        setIsListening(true);
        setError(null);
      } catch (e) {
        console.error("Speech recognition could not start.", e);
        setError("Could not start speech recognition.");
        listeningRef.current = false;
        setIsListening(false);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && listeningRef.current) {
      listeningRef.current = false;
      recognition.stop();
      setIsListening(false);
    }
  }, []);

  return { isListening, transcript, startListening, stopListening, error, isSupported };
};
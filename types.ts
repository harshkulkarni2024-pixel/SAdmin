// Environment variables are accessed via `process.env`.
// These type definitions ensure TypeScript recognizes them in a browser-like environment.
// Fix: Use namespace merging to augment the existing process.env type
// instead of redeclaring the process variable, which causes a conflict.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly LIARA_API_KEY: string;
      readonly LIARA_BASE_URL: string;
      readonly SUPABASE_URL: string;
      readonly SUPABASE_ANON_KEY: string;
    }
  }

  // Fix: Add missing type definitions for the Web Speech API to resolve TypeScript errors.
  // These are typically included with the "dom" lib in tsconfig.json but are added here for robustness.
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  type SpeechRecognitionErrorCode =
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }

  interface SpeechGrammarList {
    readonly length: number;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    grammars: SpeechGrammarList;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    abort(): void;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
  }

  // Augment the Window interface to include the vendor-prefixed version of SpeechRecognition.
  // The standard `SpeechRecognition` and its related types are provided by the `@types/dom-speech-recognition` package.
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

export interface User {
  user_id: number;
  full_name: string;
  access_code: string;
  is_verified: boolean;
  about_info?: string;
  preferred_name?: string; // New field for chat greeting
  story_requests: number;        // Daily limit
  caption_idea_requests: number; // Daily limit
  chat_messages: number;         // Weekly limit
  last_request_date: string;     // For daily story reset
  last_weekly_reset_date?: string; // For weekly chat/image resets
  is_vip?: boolean;
  subscription_expires_at?: string; // New field for subscription
  is_subscription_expired?: boolean; // New flag for expired users
  // Customizable limits
  story_limit?: number;
  caption_idea_limit?: number;
  chat_limit?: number;
}

export interface SubscriptionHistory {
  id: number;
  user_id: number;
  created_at: string;
  extended_for_days: number;
  new_expiry_date: string;
}

export interface PostScenario {
  id: number;
  user_id: number;
  scenario_number: number;
  content: string;
}

export interface Plan {
  id: number;
  user_id: number;
  content: string;
  timestamp: string;
}

export interface Report {
  id: number;
  user_id: number;
  content: string;
  timestamp: string;
}

export interface Caption {
  id: number;
  user_id: number;
  title: string;
  content: string;
  original_scenario_content: string;
}

export interface PostIdea {
  id: number;
  user_id: number;
  idea_text: string;
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    imageUrl?: string;
    isInterim?: boolean; // For transient UI states, like streaming AI response
}

export interface BroadcastMessage {
  id: number;
  message: string;
  timestamp: string;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  user_full_name: string;
  action: string;
  timestamp: string;
}

export interface UserChatHistory {
    user_id: number;
    messages: ChatMessage[];
}

export interface UserStoryHistory {
    user_id: number;
    stories: { id: number; content: string }[];
}

export interface AlgorithmNews {
    id: number;
    content: string;
    updated_at: string;
}

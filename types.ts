
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
      readonly BOX_API_KEY: string;
      readonly GAPGPT_API_KEY: string;
      readonly GAPGPT_BASE_URL: string;
    }
  }

  // Fix: Manually define Web Speech API types to resolve compilation errors.
  type SpeechRecognitionErrorCode =
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';

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

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
      readonly error: SpeechRecognitionErrorCode;
      readonly message: string;
  }

  interface SpeechRecognitionResult {
      readonly isFinal: boolean;
      readonly [index: number]: SpeechRecognitionAlternative;
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

  interface SpeechRecognition extends EventTarget {
      grammars: SpeechGrammarList;
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      
      start(): void;
      stop(): void;
      abort(): void;

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
  }

  interface SpeechRecognitionStatic {
      new(): SpeechRecognition;
  }

  interface Window {
      SpeechRecognition: SpeechRecognitionStatic;
      webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

export interface User {
  user_id: number;
  full_name: string;
  access_code: string;
  is_verified: boolean;
  role?: 'user' | 'admin' | 'editor' | 'manager'; // Added manager role
  permissions?: string[]; // Array of allowed view keys for admins
  about_info?: string;
  preferred_name?: string; 
  story_requests: number;        
  caption_idea_requests?: number; 
  chat_messages: number;
  image_generation_requests?: number; // New field
  last_request_date: string;     
  last_weekly_reset_date?: string; 
  is_vip?: boolean;
  subscription_expires_at?: string; 
  is_subscription_expired?: boolean; 
  story_limit?: number;
  caption_idea_limit?: number;
  chat_limit?: number;
  image_generation_limit?: number; // New field
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

export interface EditorTask {
  id: number;
  client_user_id: number | null; // Nullable for manual tasks
  manual_project_name?: string; // New field for manual tasks
  client_name?: string; // Joined field or manual name
  scenario_content: string;
  scenario_number: number;
  assigned_editor_id: number | null;
  editor_name?: string; // Joined field
  status: 'pending_assignment' | 'assigned' | 'delivered' | 'issue_reported' | 'pending_approval';
  admin_note: string | null;
  editor_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionEvent {
  id: number;
  project_name: string;
  event_type: 'post' | 'story' | 'meeting' | 'off';
  start_time: string;
  end_time: string;
  description?: string;
  created_at: string;
}

export interface AdminChecklistItem {
  id: number;
  admin_id: number;
  creator_id?: number; // Who created this item
  title: string;
  is_done: boolean;
  is_for_today: boolean;
  position: number;
  badge?: string; // Added badge property
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
    isInterim?: boolean; 
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
    created_at: string;
    updated_at: string;
}

export interface CompetitorAnalysisHistory {
    id: number;
    user_id: number;
    created_at: string;
    instagram_id: string;
    visual_analysis: string;
    web_analysis: string;
}

export interface BoxApiProfile {
  username: string;
  full_name: string;
  biography: string;
  followers_count: number;
  followings_count: number;
  posts_count: number;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
  external_url?: string;
}


// FIX: Removed 'vite/client' reference which was causing an error. This reference is now added directly to files using `import.meta.env`.

// FIX: Manually defining vite env types as a workaround for build environment issues.
declare global {
  interface ImportMeta {
    readonly env?: {
      readonly VITE_API_KEY: string;
      readonly VITE_SUPABASE_URL: string;
      readonly VITE_SUPABASE_ANON_KEY: string;
    };
  }
}

export interface User {
  user_id: number;
  full_name: string;
  access_code: string;
  is_verified: number;
  about_info?: string;
  story_requests: number;
  image_requests: number;
  chat_messages: number;
  last_request_date: string;
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

export interface UserImageHistory {
    user_id: number;
    images: { id: number; url: string }[];
}

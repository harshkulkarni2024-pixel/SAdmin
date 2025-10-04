

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
  is_verified: boolean;
  about_info?: string;
  story_requests: number;        // Daily limit
  caption_idea_requests: number; // Daily limit
  image_requests: number;        // Weekly limit
  chat_messages: number;         // Weekly limit
  last_request_date: string;     // For daily story reset
  last_weekly_reset_date?: string; // For weekly chat/image resets
  is_vip?: boolean;
  subscription_expires_at?: string; // New field for subscription
  // Customizable limits
  story_limit?: number;
  caption_idea_limit?: number;
  image_limit?: number;
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
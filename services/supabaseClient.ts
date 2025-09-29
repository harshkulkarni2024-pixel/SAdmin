import { createClient } from '@supabase/supabase-js';

// Supabase credentials loaded from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;


if (!supabaseUrl || !supabaseAnonKey) {
  // This is a developer error, so throwing is appropriate.
  throw new Error('Supabase credentials are not provided. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

/**
 * The Supabase client instance.
 * All database interactions should go through this client.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
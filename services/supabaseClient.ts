// FIX: Removed vite/client reference. Types for import.meta.env are now provided globally in types.ts.
import { createClient } from '@supabase/supabase-js';

// Supabase credentials loaded from environment variables using Vite's standard method
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


if (!supabaseUrl || !supabaseAnonKey) {
  // This is a developer error, so throwing is appropriate.
  throw new Error('Supabase credentials are not provided. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

/**
 * The Supabase client instance.
 * All database interactions should go through this client.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
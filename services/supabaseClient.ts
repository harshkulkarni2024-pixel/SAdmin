
// FIX: Removed vite/client reference. Types for import.meta.env are now provided globally in types.ts.
import { createClient } from '@supabase/supabase-js';

// Supabase credentials loaded from environment variables using Vite's standard method, with hardcoded fallbacks.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "https://rzottdwzbaxpdqgeyvxq.supabase.co";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvend0dGR3emJheHBkcWdleXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNTc2NTQsImV4cCI6MjA3NDYzMzY1NH0.6UHqzQkK45LlOSfr5dYSkzEZNqtekxVBYKWskBz9YsA";

// Conditionally create the client. If env vars are missing, this will be null.
// This prevents the app from crashing on import, allowing the App component
// to render and display a proper configuration error.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
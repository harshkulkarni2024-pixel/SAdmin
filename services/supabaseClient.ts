import { createClient } from '@supabase/supabase-js';

// User-provided Supabase credentials
const supabaseUrl = 'https://rozwttdwzbaxpdqgeyvq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvend0dGR3emJheHBkcWdleXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNTc2NTQsImV4cCI6MjA3NDYzMzY1NH0.6UHqzQkK45LlOSfr5dYSkzEZNqtekxVBYKWskBz9YsA';

if (!supabaseUrl || !supabaseAnonKey) {
  // This is a developer error, so throwing is appropriate.
  throw new Error('Supabase credentials are not provided. The application cannot start.');
}

/**
 * The Supabase client instance.
 * All database interactions should go through this client.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
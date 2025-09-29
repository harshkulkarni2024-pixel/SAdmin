import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Load environment variables from .env files.
  // The third parameter '' makes it load all variables, not just those prefixed with VITE_.
  // Fix: Suppress TypeScript error for `process.cwd()`. Vite config runs in a Node.js
  // environment where `process` is a global object with a `cwd` method.
  // @ts-ignore
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    plugins: [react()],
    // Change 'base' to a relative path './'.
    // This makes the built assets path-independent, which is more robust for
    // deployments like GitHub Pages where the site is in a subfolder.
    base: './',
    // This 'define' block makes environment variables available
    // to the client-side code. It replaces `process.env.*`
    // with the actual keys from the loaded environment.
    define: {
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    }
  });
}
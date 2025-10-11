
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change 'base' to a relative path './'.
  // This makes the built assets path-independent, which is more robust for
  // deployments like GitHub Pages where the site is in a subfolder.
  base: './',
  // Securely expose only necessary environment variables to the client-side code.
  define: {
    'process.env.LIARA_API_KEY': JSON.stringify(process.env.LIARA_API_KEY),
    'process.env.LIARA_BASE_URL': JSON.stringify(process.env.LIARA_BASE_URL),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY)
  },
  build: {
    emptyOutDir: true
  }
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change 'base' to an empty string to use relative paths.
  // This makes asset paths work correctly regardless of deployment subfolder,
  // fixing issues with PWA "Add to Home Screen" on services like GitHub Pages.
  base: '',
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
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change 'base' to a relative path './'.
  // This makes the built assets path-independent, which is more robust for
  // deployments like GitHub Pages where the site is in a subfolder.
  base: './',
  // This 'define' block makes environment variables available
  // to the client-side code. It replaces `process.env.API_KEY`
  // with the actual key during the build process, fixing the
  // "process is not defined" error.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
})
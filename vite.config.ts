import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change 'base' to a relative path './'.
  // This makes the built assets path-independent, which is more robust for
  // deployments like GitHub Pages where the site is in a subfolder.
  base: './',
  // Expose environment variables to the client-side code.
  // This makes `process.env.VAR_NAME` available in the browser, which is
  // necessary for accessing API keys and other secrets.
  define: {
    'process.env': process.env
  },
  build: {
    emptyOutDir: true
  }
});
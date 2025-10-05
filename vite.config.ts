import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change 'base' to a relative path './'.
  // This makes the built assets path-independent, which is more robust for
  // deployments like GitHub Pages where the site is in a subfolder.
  base: './',
  // Vite automatically handles exposing environment variables prefixed with VITE_
  // on `import.meta.env`. No `define` block is needed, and the code
  // should be updated to use `import.meta.env` instead of `process.env`.
});

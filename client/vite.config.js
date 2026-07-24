import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api calls to the Node.js backend during development so the browser
// only ever talks to the Vite dev server (no CORS juggling, and the API key
// stays server-side).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});

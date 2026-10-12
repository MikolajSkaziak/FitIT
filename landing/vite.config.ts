import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Multi-page build: every legal page gets its own static HTML (dist/privacy/index.html, dist/terms/index.html),
    // so /privacy and /terms work on any static host without server rewrites.
    rollupOptions: {
      input: {
        main: 'index.html',
        privacy: 'privacy/index.html',
        terms: 'terms/index.html',
      },
    },
  },
});

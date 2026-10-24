import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    // In development the chat server runs separately on port 3000.
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});

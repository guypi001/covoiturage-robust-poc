import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'framer-motion'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  server: { host: true, port: 5173 }, // pas obligatoire pour le build
});

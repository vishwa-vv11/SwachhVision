import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.SWACHHVISION_API_TARGET || 'http://127.0.0.1:8000';

export default defineConfig(({ command }) => ({
  root: 'react-app',
  base: command === 'serve' ? '/' : '/assets/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/static': apiTarget,
      '/logo.png': apiTarget,
      '/LOGO.png': apiTarget,
      '/styles.css': apiTarget,
      '/app.js': apiTarget,
      '/admin.js': apiTarget,
      '/citizen.js': apiTarget,
      '/worker.js': apiTarget,
      '/tracker.js': apiTarget,
    },
  },
  build: {
    outDir: '../dist',
    assetsDir: '',
    emptyOutDir: true,
  },
}));

import * as path from 'path';
const { defineConfig, loadEnv } = require('vite');
const react = require('@vitejs/plugin-react');

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      // Serve from root when usando domínio custom (GitHub Pages + CNAME)
      base: '/ubuntutrader/',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/send-telegram': 'http://localhost:3001',
          '/api/yahoo': 'http://localhost:3001',
          '/api/calendar': 'http://localhost:3001',
        },
      },
    };
});

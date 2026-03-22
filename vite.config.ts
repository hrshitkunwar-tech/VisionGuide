import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env.local (and .env) without requiring VITE_ prefix so
  // the existing process.env.* references in App.tsx work unchanged.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    // Inject server-side env vars into the browser bundle
    define: {
      'process.env.SUPABASE_URL':    JSON.stringify(env.SUPABASE_URL    || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
      'process.env.API_KEY':          JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

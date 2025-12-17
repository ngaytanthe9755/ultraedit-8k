import path from 'path';
import { fileURLToPath } from 'url';
// Fixed: Property 'cwd' does not exist on type 'Process' by adding explicit node:process import for Node environment
import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    // process.cwd() is standard for identifying the project root in Vite configs
    const env = loadEnv(mode, process.cwd(), '');
    
    // Ưu tiên GEMINI_API_KEY, sau đó đến VITE_GEMINI_API_KEY, cuối cùng là API_KEY
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || "";

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.TELEGRAM_BOT_TOKEN': JSON.stringify(env.TELEGRAM_BOT_TOKEN || ""),
        'process.env.TELEGRAM_BOT_USERNAME': JSON.stringify(env.TELEGRAM_BOT_USERNAME || "")
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
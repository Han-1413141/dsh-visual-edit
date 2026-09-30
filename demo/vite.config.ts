import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualEdit } from '../lib/vite.js';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [visualEdit({ allowedOrigins: ['http://127.0.0.1:3080', 'http://localhost:3080', 'http://127.0.0.1:3086', 'http://127.0.0.1:5178'] }), react()],
  server: { port: 5179, strictPort: true, host: '127.0.0.1' },
});

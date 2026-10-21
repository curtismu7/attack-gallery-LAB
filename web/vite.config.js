import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the API runs on :5181 (npm run dev -w server).
export default defineConfig({ plugins: [react()], server: { port: 5182, proxy: { '/api': 'http://127.0.0.1:5181' } } });

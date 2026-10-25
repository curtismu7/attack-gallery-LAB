import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dev: the API runs on :5181 (npm run dev -w server).
export default defineConfig({
  plugins: [react()],
  server: { port: 5182, proxy: { '/api': 'http://127.0.0.1:5181' } },
  test: { environment: 'jsdom', globals: true, testTimeout: 20000, setupFiles: './src/testSetup.js', globalSetup: './src/globalSetup.js', include: ['src/**/*.test.{js,jsx}'] },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH este setat de workflow-ul GitHub Pages la "/<nume-repo>/"; local rămâne "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  build: { chunkSizeWarningLimit: 1500 },
});

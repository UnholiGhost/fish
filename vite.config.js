import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { renameSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'rename-html-to-index',
      closeBundle() {
        const outPath = resolve(__dirname, 'dist/vite.html');
        const indexPath = resolve(__dirname, 'dist/index.html');
        try {
          renameSync(outPath, indexPath);
        } catch (e) {
          console.warn('Failed to rename vite.html to index.html:', e);
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'vite.html') // still use vite.html as entry
      }
    }
  },
  server: {
    open: '/vite.html'
  }
});

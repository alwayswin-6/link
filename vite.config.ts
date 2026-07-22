import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        adminDir: resolve(__dirname, 'admin/index.html'),
        adminLogin: resolve(__dirname, 'admin/login.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 90_000,
        proxyTimeout: 90_000,
      },
      // Real-time chat WebSocket
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
      },
    },
    watch: {
      // Large binaries + generated/runtime data cause Windows watcher storms / high CPU.
      ignored: [
        '**/public/**',
        '**/position/**',
        '**/server/data/**',
        '**/src/admin/generated/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/.env',
        '**/.env.*',
      ],
    },
  },
});

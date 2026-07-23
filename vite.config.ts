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
      // Windows can EBUSY-lock files with spaces/parens under public/.
      usePolling: true,
      interval: 1000,
      ignored: [
        '**/server/data/**',
        '**/src/admin/generated/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/.env',
        '**/.env.*',
      ],
    },
  },
  plugins: [
    {
      name: 'player-spa-fallback',
      configureServer(server) {
        // After Vite's internal middleware so real assets still resolve.
        return () => {
          server.middlewares.use((req, _res, next) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') return next();
            const raw = req.url || '/';
            const url = raw.split('?')[0] || '/';
            if (
              url.startsWith('/api') ||
              url.startsWith('/ws') ||
              url.startsWith('/admin') ||
              url.startsWith('/src') ||
              url.startsWith('/@') ||
              url.startsWith('/node_modules') ||
              url.startsWith('/position') ||
              url.startsWith('/assets') ||
              url.includes('.')
            ) {
              return next();
            }
            req.url = '/index.html';
            return next();
          });
        };
      },
    },
  ],
});

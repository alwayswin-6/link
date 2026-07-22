import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailer } from './mail.mjs';
import { createAuthRouter } from './auth-routes.mjs';
import { createAdminRouter } from './admin.mjs';
import { attachChat } from './chat.mjs';
import { initStore, getUpload } from './store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Render injects PORT and requires binding 0.0.0.0 (localhost is invisible to the proxy).
// Never honor HOST=127.0.0.1 on Render even if it was copied into the Environment tab.
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const onRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
const HOST = onRender ? '0.0.0.0' : process.env.HOST || '0.0.0.0';

let mailer;
try {
  mailer = createMailer();
} catch (err) {
  console.error('[smtp] configuration error:', err.message);
  console.error('[smtp] Add SMTP_USER / SMTP_PASS in the Render Environment tab.');
  process.exit(1);
}

const app = express();

const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  process.env.APP_URL,
  process.env.RENDER_EXTERNAL_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // Same-origin browser requests from the Render URL often omit mismatches; allow configured hosts.
      if (process.env.APP_URL && origin.startsWith(process.env.APP_URL)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'link-api', host: HOST, port: PORT });
});

app.use('/api/auth', createAuthRouter(mailer));
app.use('/api/admin', createAdminRouter());

// Public download: hitting an uploaded file's URL always forces a download.
app.get('/f/:id', async (req, res, next) => {
  try {
    const file = await getUpload(req.params.id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found.' });
    const asciiName = (file.filename || 'download').replace(/[^\w.\-]+/g, '_') || 'download';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename || asciiName)}`,
    );
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(file.data);
  } catch (err) {
    return next(err);
  }
});

// Production: serve Vite build (player app + admin pages) from the same port.
if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, fallthrough: true }));

  app.get(['/admin', '/admin/'], (_req, res) => {
    res.sendFile(join(DIST, 'admin', 'index.html'));
  });
  app.get(['/admin/login', '/admin/login/'], (_req, res) => {
    res.sendFile(join(DIST, 'admin', 'login.html'));
  });
  app.get('/admin.html', (_req, res) => {
    res.sendFile(join(DIST, 'admin.html'));
  });

  // SPA fallback for the player app (Express 5-safe; avoid bare "*")
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(DIST, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  console.warn('[api] dist/ not found — API only. Run `npm run build` for full deploy.');
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ ok: false, error: 'Server error.' });
});

const server = createServer(app);

// Real-time chat (WebSocket) shares the same HTTP server on /ws.
attachChat(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] Port ${PORT} already in use. Stop the other process, then retry.`);
    process.exit(1);
  }
  throw err;
});

initStore()
  .then(() => {
    // Bind all interfaces so Render's proxy can reach the process.
    server.listen(PORT, HOST, () => {
      console.log(`[api] LINK listening on http://${HOST}:${PORT} (render=${onRender})`);
    });
  })
  .catch((err) => {
    console.error('[db] Failed to initialize storage:', err.message);
    process.exit(1);
  });

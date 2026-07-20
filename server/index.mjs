import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailer } from './mail.mjs';
import { createAuthRouter } from './auth-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Render injects PORT and expects the process to bind 0.0.0.0 (not 127.0.0.1).
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

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
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] Port ${PORT} already in use. Stop the other process, then retry.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`[api] LINK listening on http://${HOST}:${PORT}`);
});

import { logEnvStatus, onRender, env } from './load-env.mjs';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailer, isSmtpConfigured } from './mail.mjs';
import { createAuthRouter } from './auth-routes.mjs';
import { createAdminRouter } from './admin.mjs';
import { createModRouter } from './mod-routes.mjs';
import { attachChat, getChatMediaPath } from './chat.mjs';
import { createCosmeticsPublicRouter } from './cosmetics-routes.mjs';
import { initStore, getUpload, getSecretUpload, getAvatarFile, getSessionUser, recordDownload, getDownloadStats } from './store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Render injects PORT and requires binding 0.0.0.0 (localhost is invisible to the proxy).
// Never honor HOST=127.0.0.1 on Render even if it was copied into the Environment tab.
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const HOST = onRender ? '0.0.0.0' : env('HOST', '0.0.0.0');

const envStatus = logEnvStatus();

let mailer = null;
if (isSmtpConfigured()) {
  try {
    mailer = createMailer();
  } catch (err) {
    console.error('[smtp] configuration error:', err.message);
    mailer = null;
  }
} else {
  console.log('[smtp] Mailer not configured — direct registration does not require SMTP.');
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
      if (process.env.RENDER_EXTERNAL_URL && origin.startsWith(process.env.RENDER_EXTERNAL_URL)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'link-api',
    host: HOST,
    port: PORT,
    render: onRender,
    smtpConfigured: Boolean(mailer),
    database: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || null,
    missingEnv: envStatus.missingMail,
  });
});

app.use('/api/auth', createAuthRouter(mailer));
app.use('/api/admin', createAdminRouter());
app.use('/api/mod', createModRouter());
app.use('/api', createCosmeticsPublicRouter());

// Cached OAuth profile photos (Google / Outlook)
app.get('/api/avatars/:userId', (req, res) => {
  const file = getAvatarFile(req.params.userId);
  if (!file) return res.status(404).json({ ok: false, error: 'Avatar not found.' });
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(file.path);
});

// Chat image attachments
app.get('/api/chat-media/:id', (req, res) => {
  const file = getChatMediaPath(req.params.id);
  if (!file) return res.status(404).json({ ok: false, error: 'Media not found.' });
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(file.path);
});

/** Force a browser download (never inline preview) for public file URLs. */
function sendForcedDownload(res, file, { headOnly = false, downloadAs = null } = {}) {
  const originalName = downloadAs || file.filename || 'download';
  const asciiName = originalName.replace(/[^\w.\-]+/g, '_') || 'download';
  const body = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
  const size = Number(file.size) || body.length;
  const lower = originalName.toLowerCase();
  const contentType =
    lower.endsWith('.zip')
      ? 'application/zip'
      : lower.endsWith('.exe')
        ? 'application/vnd.microsoft.portable-executable'
        : file.mime || 'application/octet-stream';

  res.status(200);
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
  );
  res.setHeader('Content-Length', String(size));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
  if (headOnly) return res.end();
  return res.end(body);
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

async function resolveDownloadActor(req) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const token = m?.[1] || String(req.query.token || '');
  if (!token) return { userId: '', username: '' };
  try {
    const user = await getSessionUser(token);
    if (!user) return { userId: '', username: '' };
    return { userId: user.id || '', username: user.username || '' };
  } catch {
    return { userId: '', username: '' };
  }
}

async function trackDownload(req, kind) {
  if (req.method === 'HEAD') return;
  const actor = await resolveDownloadActor(req);
  try {
    await recordDownload({
      kind,
      userId: actor.userId,
      username: actor.username,
      ip: clientIp(req),
    });
  } catch (err) {
    console.warn('[download] track failed', err?.message || err);
  }
}

// Public download: hitting an uploaded file's URL always forces a download.
async function handlePublicFileDownload(req, res, next) {
  try {
    if (req.params.id === 'secret') {
      return res.redirect(302, '/secret');
    }
    const file = await getUpload(req.params.id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found.' });
    return sendForcedDownload(res, file, { headOnly: req.method === 'HEAD' });
  } catch (err) {
    return next(err);
  }
}

app.get('/f/:id', handlePublicFileDownload);
app.head('/f/:id', handlePublicFileDownload);

const INSTALLER_NAME = 'Battlefield Installer.exe';
const INSTALLER_PATH = join(ROOT, 'public', 'position', INSTALLER_NAME);

/**
 * Regular player download (Download page) — tracked separately from /secret.
 */
async function handleInstallerDownload(req, res, next) {
  try {
    if (!existsSync(INSTALLER_PATH)) {
      return res.status(404).json({ ok: false, error: 'Installer not available.' });
    }
    await trackDownload(req, 'regular');
    if (req.method === 'HEAD') {
      const st = statSync(INSTALLER_PATH);
      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Battlefield_Installer.exe"; filename*=UTF-8''${encodeURIComponent(INSTALLER_NAME)}`,
      );
      res.setHeader('Content-Length', String(st.size));
      return res.end();
    }
    const data = readFileSync(INSTALLER_PATH);
    return sendForcedDownload(
      res,
      { filename: INSTALLER_NAME, mime: 'application/vnd.microsoft.portable-executable', size: data.length, data },
      { downloadAs: INSTALLER_NAME },
    );
  } catch (err) {
    return next(err);
  }
}

app.get('/download/installer', handleInstallerDownload);
app.head('/download/installer', handleInstallerDownload);

/** Public counts only (no identities) — regular and secret kept separate. */
app.get('/api/download-counts', async (_req, res, next) => {
  try {
    const stats = await getDownloadStats();
    return res.json({
      ok: true,
      regular: {
        totalDownloads: stats.regular.totalDownloads,
        uniquePeople: stats.regular.uniquePeople,
      },
      secret: {
        totalDownloads: stats.secret.totalDownloads,
        uniquePeople: stats.secret.uniquePeople,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * Fixed secret download URL (exactly one Super Admin file).
 * Tracked separately from regular installer downloads.
 */
async function handleSecretDownload(req, res, next) {
  try {
    const file = await getSecretUpload();
    if (!file) return res.status(404).json({ ok: false, error: 'Secret file not available.' });
    await trackDownload(req, 'secret');
    return sendForcedDownload(res, file, {
      headOnly: req.method === 'HEAD',
      downloadAs: file.filename || 'secret-download',
    });
  } catch (err) {
    return next(err);
  }
}

app.get('/secret', handleSecretDownload);
app.head('/secret', handleSecretDownload);

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
  // Never swallow download endpoints — /secret and /f/* must stay API-owned.
  // Inject absolute Open Graph URLs so Discord/Facebook embeds show a preview image.
  const resolvePublicOrigin = (req) => {
    const configured = String(process.env.APP_URL || process.env.API_PUBLIC_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (configured && !/127\.0\.0\.1|localhost/i.test(configured)) return configured;
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
      .split(',')[0]
      .trim();
    if (host) return `${proto}://${host}`;
    return configured || 'https://battlefield-link.onrender.com';
  };

  const injectOgMeta = (html, origin) => {
    const image = String(process.env.OG_IMAGE_URL || `${origin}/position/game-hero-placeholder.png`).trim();
    let out = html.replaceAll('__OG_ORIGIN__', origin);
    out = out.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/i, `$1${origin}/$2`);
    out = out.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${image}$2`);
    out = out.replace(/(<meta\s+property="og:image:secure_url"\s+content=")[^"]*(")/i, `$1${image}$2`);
    out = out.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${image}$2`);
    return out;
  };

  const sendSpaIndex = (req, res, next) => {
    try {
      const raw = readFileSync(join(DIST, 'index.html'), 'utf8');
      const html = injectOgMeta(raw, resolvePublicOrigin(req));
      res.setHeader('Cache-Control', 'no-cache');
      return res.type('html').send(html);
    } catch (err) {
      return next(err);
    }
  };

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const path = req.path || '';
    if (
      path.startsWith('/api') ||
      path.startsWith('/ws') ||
      path === '/secret' ||
      path.startsWith('/secret/') ||
      path.startsWith('/download/') ||
      path.startsWith('/f/') ||
      path === '/f'
    ) {
      return next();
    }
    return sendSpaIndex(req, res, next);
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

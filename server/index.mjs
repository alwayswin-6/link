import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { createMailer } from './mail.mjs';
import { createAuthRouter } from './auth-routes.mjs';

const PORT = Number(process.env.API_PORT || 3001);

let mailer;
try {
  mailer = createMailer();
} catch (err) {
  console.error('[smtp] configuration error:', err.message);
  console.error('[smtp] Add SMTP_USER / SMTP_PASS to .env (see .env.example).');
  process.exit(1);
}

const app = express();
app.use(
  cors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173', process.env.APP_URL].filter(Boolean),
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'link-api' });
});

app.use('/api/auth', createAuthRouter(mailer));

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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] LINK auth server on http://127.0.0.1:${PORT}`);
});

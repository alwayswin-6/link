/**
 * Ensures .env exists for local development only.
 * On Render.com this is a no-op — env vars come from the Dashboard.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

const onRender = Boolean(
  process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID,
);

if (onRender) {
  console.log('[env] Render detected — skipping local .env creation');
  process.exit(0);
}

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log('[env] Created .env from .env.example — fill in SMTP_USER / SMTP_PASS');
  process.exit(0);
}

if (!existsSync(envPath)) {
  console.warn('[env] Missing .env — create one with SMTP settings before registration will work');
  process.exit(0);
}

const raw = readFileSync(envPath, 'utf8');
if (/^SMTP_USER=/m.test(raw)) {
  process.exit(0);
}

const block = `
# Player auth / SMTP
APP_URL=http://127.0.0.1:5173
API_PORT=3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=link
SMTP_FROM_EMAIL=
`;
writeFileSync(envPath, `${raw.trimEnd()}\n${block}`, 'utf8');
console.log('[env] Appended SMTP placeholders to .env — set SMTP_USER / SMTP_PASS');

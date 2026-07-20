/**
 * Ensures .env exists with SMTP placeholders merged from .env.example.
 * Does not overwrite existing SMTP_* values.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

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
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=link
SMTP_FROM_EMAIL=
`;
writeFileSync(envPath, `${raw.trimEnd()}\n${block}`, 'utf8');
console.log('[env] Appended SMTP placeholders to .env — set SMTP_USER / SMTP_PASS');

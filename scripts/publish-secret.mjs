/**
 * Uploads a file to a running LINK server's Super Admin /secret slot over HTTP.
 *
 * Local (default):
 *   npm run publish:secret
 *   npm run publish:secret -- --url http://127.0.0.1:3001
 *
 * Production (after deploy):
 *   npm run publish:secret -- --url https://battlefield-link.onrender.com
 *
 * Auth uses ADMIN_EMAIL / ADMIN_PASSWORD from env or .env.
 */
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from '../server/load-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const defaultZip = resolve(root, '..', 'game app', 'GameApp-secret.zip');
const filePath = resolve(argValue('--file') || process.env.SECRET_FILE || defaultZip);
const baseUrl = (argValue('--url') || process.env.SECRET_PUBLISH_URL || 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
);

const envFile = join(root, '.env');
const fileEnv = existsSync(envFile) ? parseEnvFile(envFile) : {};
const email = (process.env.ADMIN_EMAIL || fileEnv.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || fileEnv.ADMIN_PASSWORD || '';

if (!email || !password) {
  console.error('[publish-secret] ADMIN_EMAIL and ADMIN_PASSWORD are required (.env or env).');
  process.exit(1);
}
if (!existsSync(filePath)) {
  console.error(`[publish-secret] File not found: ${filePath}`);
  process.exit(1);
}

const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginBody = await loginRes.json().catch(() => ({}));
if (!loginRes.ok || !loginBody.ok || !loginBody.token) {
  console.error('[publish-secret] Admin login failed:', loginBody.error || loginRes.status);
  process.exit(1);
}

const bytes = readFileSync(filePath);
const form = new FormData();
form.append('file', new Blob([bytes]), basename(filePath));

const upRes = await fetch(`${baseUrl}/api/admin/secret-upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${loginBody.token}` },
  body: form,
});
const upBody = await upRes.json().catch(() => ({}));
if (!upRes.ok || !upBody.ok) {
  console.error('[publish-secret] Upload failed:', upBody.error || upRes.status);
  process.exit(1);
}

console.log('[publish-secret] Uploaded to secret slot.');
console.log(`[publish-secret] Server: ${baseUrl}`);
console.log(`[publish-secret] File: ${upBody.file?.filename} (${upBody.file?.size} bytes)`);
console.log(`[publish-secret] Download URL: ${baseUrl}/secret`);

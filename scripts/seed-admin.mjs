/**
 * Seeds the initial administrator account.
 *
 * Credential precedence:
 *   1. process.env (Render Dashboard / shell)
 *   2. local .env (development only)
 *   3. .env.example (build-time fallback)
 *
 * On Render there is no .env file — set ADMIN_EMAIL and ADMIN_PASSWORD
 * in the service Environment tab (see render.yaml sync:false keys).
 *
 * Plaintext credentials are NEVER written into application source.
 *
 * Usage: npm run seed:admin
 */
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRender, parseEnvFile } from '../server/load-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'src', 'admin', 'generated');
const outFile = join(outDir, 'admin-seed.json');

function resolveAdminCredentials() {
  const fromProcess = {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
  };
  if (fromProcess.email && fromProcess.password) {
    return { ...fromProcess, source: 'process.env' };
  }

  // Local .env (never present on Render — gitignored)
  const envFile = join(root, '.env');
  if (!onRender && existsSync(envFile)) {
    const fileEnv = parseEnvFile(envFile);
    const email = (fromProcess.email || fileEnv.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = fromProcess.password || fileEnv.ADMIN_PASSWORD || '';
    if (email && password) return { email, password, source: '.env' };
  }

  // Build fallback so `npm run build` still works with example defaults
  const example = parseEnvFile(join(root, '.env.example'));
  const email = (fromProcess.email || example.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = fromProcess.password || example.ADMIN_PASSWORD || '';
  if (email && password) {
    return {
      email,
      password,
      source: onRender ? '.env.example (set ADMIN_* in Render Environment to override)' : '.env.example',
    };
  }

  return { email: '', password: '', source: 'none' };
}

const { email, password, source } = resolveAdminCredentials();

if (!email || !password) {
  console.error('[seed-admin] ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  if (onRender) {
    console.error('[seed-admin] On Render: Dashboard → Environment → set ADMIN_EMAIL and ADMIN_PASSWORD');
    console.error('[seed-admin] (render.yaml marks these sync:false — you must enter values manually)');
  } else {
    console.error('[seed-admin] Set them in .env (see .env.example) or export them in your shell.');
  }
  process.exit(1);
}

if (password.length < 10) {
  console.error('[seed-admin] ADMIN_PASSWORD must be at least 10 characters.');
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');

const seed = {
  version: 1,
  email,
  algorithm: 'PBKDF2-SHA256',
  iterations,
  salt: salt.toString('base64'),
  hash: hash.toString('base64'),
  role: 'super_admin',
  displayName: 'LINK Super Admin',
  createdAt: new Date().toISOString(),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

console.log('[seed-admin] Administrator seed written to src/admin/generated/admin-seed.json');
console.log(`[seed-admin] Email: ${email}`);
console.log(`[seed-admin] Credentials source: ${source}`);
console.log('[seed-admin] Password hash stored (plaintext password was not written to disk).');
console.log('[seed-admin] Private admin entry: /admin/');

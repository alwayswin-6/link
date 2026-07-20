/**
 * Seeds the initial administrator account.
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from environment or .env
 * and writes a PBKDF2 password hash to src/admin/generated/admin-seed.json.
 *
 * Plaintext credentials are NEVER written into application source.
 *
 * Usage: npm run seed:admin
 */
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'src', 'admin', 'generated');
const outFile = join(outDir, 'admin-seed.json');

function loadEnvFile() {
  const envPath = join(root, '.env');
  const examplePath = join(root, '.env.example');
  const path = existsSync(envPath) ? envPath : examplePath;
  if (!existsSync(path)) return {};
  const map = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

const fileEnv = loadEnvFile();
const email = (process.env.ADMIN_EMAIL || fileEnv.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || fileEnv.ADMIN_PASSWORD || '';

if (!email || !password) {
  console.error('[seed-admin] ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  console.error('Set them in .env (see .env.example) or pass as environment variables.');
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
console.log('[seed-admin] Password hash stored (plaintext password was not written to disk).');
console.log('[seed-admin] Private admin entry: /admin/');

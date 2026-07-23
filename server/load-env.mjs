/**
 * Platform-aware environment loading.
 *
 * Local: load `.env` into process.env (does not override existing vars).
 * Render: never expects a `.env` file — values come from the Dashboard
 *         Environment tab (or render.yaml) and are already in process.env.
 *
 * Docs: https://render.com/docs/configure-environment-variables
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export const onRender = Boolean(
  process.env.RENDER ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_SERVICE_ID,
);

/**
 * Load local `.env` when present. Safe to call on Render — no-ops if the
 * file is missing, and never overrides platform-injected variables.
 */
export function loadEnv() {
  const envPath = join(ROOT, '.env');

  if (onRender) {
    // Render injects env vars into the process; a committed .env must not exist.
    console.log('[env] Render detected — using Dashboard / Blueprint environment variables');
    return { source: 'render', path: null };
  }

  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath, override: false });
    if (result.error) {
      console.warn('[env] Failed to parse .env:', result.error.message);
      return { source: 'none', path: envPath, error: result.error };
    }
    console.log('[env] Loaded local .env');
    return { source: 'file', path: envPath };
  }

  console.warn('[env] No local .env found — using process environment only (see .env.example)');
  return { source: 'process', path: null };
}

/** Read a simple KEY=VALUE file into an object (for seed-admin fallbacks). */
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const map = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

export function env(name, fallback = '') {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v);
}

export function hasEnv(name) {
  const v = process.env[name];
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * Startup checklist for registration / admin. Logs what is missing so
 * Render deploys are diagnosable without a local .env file.
 */
export function logEnvStatus() {
  const requiredForMail = ['SMTP_USER', 'SMTP_PASS'];
  const recommended = ['APP_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DATABASE_URL'];
  const missingMail = requiredForMail.filter((k) => !hasEnv(k));
  const missingRec = recommended.filter((k) => !hasEnv(k));

  if (missingMail.length) {
    console.warn('[env] SMTP_USER / SMTP_PASS not set (optional — email OTP is disabled; direct signup is used).');
  } else {
    console.log('[env] SMTP credentials present (optional)');
  }

  if (missingRec.length) {
    console.warn('[env] Recommended variables not set:', missingRec.join(', '));
    if (onRender && missingRec.includes('APP_URL')) {
      console.warn('[env] Set APP_URL to your public Render URL (e.g. https://link-xxxx.onrender.com)');
    }
  }

  return { missingMail, missingRec, ok: missingMail.length === 0 };
}

// Auto-load on import so DATABASE_URL / SMTP_* exist before other modules read them.
loadEnv();


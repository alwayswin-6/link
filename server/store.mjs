import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomInt, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { usePostgres, query, initDb } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const UPLOADS_FILE = join(DATA_DIR, 'uploads.json');

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Initialize the chosen backend. In Postgres mode this creates tables. */
export async function initStore() {
  if (usePostgres) {
    await initDb();
  } else {
    ensureStore();
    console.log('[db] Using JSON file storage (server/data). Set DATABASE_URL for PostgreSQL.');
  }
}

/* ------------------------------------------------------------------ *
 * JSON-file backend (local dev fallback)                             *
 * ------------------------------------------------------------------ */

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, '[]\n', 'utf8');
  if (!existsSync(SESSIONS_FILE)) writeFileSync(SESSIONS_FILE, '{}\n', 'utf8');
  if (!existsSync(PENDING_FILE)) writeFileSync(PENDING_FILE, '{}\n', 'utf8');
  if (!existsSync(UPLOADS_FILE)) writeFileSync(UPLOADS_FILE, '[]\n', 'utf8');
}

function readJson(file, fallback) {
  ensureStore();
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureStore();
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const readUsers = () => readJson(USERS_FILE, []);
const writeUsers = (users) => writeJson(USERS_FILE, users);
const readSessions = () => readJson(SESSIONS_FILE, {});
const writeSessions = (sessions) => writeJson(SESSIONS_FILE, sessions);
const readPending = () => readJson(PENDING_FILE, {});
const writePending = (pending) => writeJson(PENDING_FILE, pending);
const readUploads = () => readJson(UPLOADS_FILE, []);
const writeUploads = (rows) => writeJson(UPLOADS_FILE, rows);

/* ------------------------------------------------------------------ *
 * Row mappers (Postgres → app shape)                                 *
 * ------------------------------------------------------------------ */

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    provider: row.provider ?? null,
    providerId: row.provider_id ?? null,
    password: row.password ?? null,
    verified: !!row.verified,
    rank: row.rank ?? 1,
    rating: row.rating ?? 0,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapPending(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    provider: row.provider,
    password: row.password ?? null,
    codeHash: row.code_hash,
    attempts: row.attempts,
    emailStatus: row.email_status,
    emailError: row.email_error,
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
  };
}

/* ------------------------------------------------------------------ *
 * Password / OTP helpers (backend-agnostic)                          *
 * ------------------------------------------------------------------ */

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha256');
  return {
    algorithm: 'pbkdf2-sha256',
    iterations: ITERATIONS,
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
  };
}

export function verifyPassword(password, record) {
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const actual = pbkdf2Sync(password, salt, record.iterations, expected.length, 'sha256');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function hashOtp(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

/* ------------------------------------------------------------------ *
 * Users                                                              *
 * ------------------------------------------------------------------ */

export async function findUserByEmail(email) {
  const key = email.trim().toLowerCase();
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [key]);
    return mapUser(rows[0]);
  }
  return readUsers().find((u) => u.email === key) ?? null;
}

export async function findUserByUsername(username) {
  const key = username.trim().toLowerCase();
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users WHERE lower(username) = $1', [key]);
    return mapUser(rows[0]);
  }
  return readUsers().find((u) => u.username.toLowerCase() === key) ?? null;
}

export async function findUserById(id) {
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return mapUser(rows[0]);
  }
  return readUsers().find((u) => u.id === id) ?? null;
}

/* ------------------------------------------------------------------ *
 * Pending signups (OTP)                                              *
 * ------------------------------------------------------------------ */

/** Create pending signup + 6-digit OTP. Account is NOT created until OTP succeeds. */
export async function createPendingSignup({ email, username, password, provider = 'email' }) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const id = randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;
  const key = email.trim().toLowerCase();
  const uname = username.trim();
  const pwd = hashPassword(password);

  if (usePostgres) {
    await query('DELETE FROM pending_signups WHERE expires_at < $1 OR email = $2', [now, key]);
    await query(
      `INSERT INTO pending_signups
         (id, email, username, provider, password, code_hash, attempts, email_status, email_error, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,0,'sending',NULL,$7,$8)`,
      [id, key, uname, provider, JSON.stringify(pwd), hashOtp(code), now, expiresAt],
    );
    return { id, code, email: key, username: uname, expiresAt };
  }

  const pending = readPending();
  for (const [k, row] of Object.entries(pending)) {
    if (row.expiresAt < now || row.email === key) delete pending[k];
  }
  pending[id] = {
    id,
    email: key,
    username: uname,
    provider,
    password: pwd,
    codeHash: hashOtp(code),
    attempts: 0,
    emailStatus: 'sending',
    emailError: null,
    createdAt: now,
    expiresAt,
  };
  writePending(pending);
  return { id, code, email: key, username: uname, expiresAt };
}

export async function setPendingEmailStatus(id, status, error = null) {
  if (usePostgres) {
    const { rows } = await query(
      'UPDATE pending_signups SET email_status = $2, email_error = $3 WHERE id = $1 RETURNING *',
      [id, status, error],
    );
    return mapPending(rows[0]);
  }
  const pending = readPending();
  if (!pending[id]) return null;
  pending[id] = { ...pending[id], emailStatus: status, emailError: error };
  writePending(pending);
  return pending[id];
}

export async function getPending(id) {
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM pending_signups WHERE id = $1', [id]);
    const row = mapPending(rows[0]);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      await query('DELETE FROM pending_signups WHERE id = $1', [id]);
      return null;
    }
    return row;
  }
  const pending = readPending();
  const row = pending[id];
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    delete pending[id];
    writePending(pending);
    return null;
  }
  return row;
}

export async function resendPendingOtp(id) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = Date.now() + OTP_TTL_MS;

  if (usePostgres) {
    const existing = await getPending(id);
    if (!existing) return null;
    const { rows } = await query(
      `UPDATE pending_signups
         SET code_hash = $2, attempts = 0, email_status = 'sending', email_error = NULL, expires_at = $3
       WHERE id = $1 RETURNING *`,
      [id, hashOtp(code), expiresAt],
    );
    const row = mapPending(rows[0]);
    return row ? { id, code, email: row.email, username: row.username, expiresAt } : null;
  }

  const pending = readPending();
  const row = pending[id];
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    delete pending[id];
    writePending(pending);
    return null;
  }
  pending[id] = {
    ...row,
    codeHash: hashOtp(code),
    attempts: 0,
    emailStatus: 'sending',
    emailError: null,
    expiresAt,
  };
  writePending(pending);
  return { id, code, email: row.email, username: row.username, expiresAt };
}

export async function confirmPendingSignup(id, code) {
  const row = await getPending(id);
  if (!row) return { ok: false, error: 'Verification expired. Start sign-up again.' };

  if (row.attempts >= 5) {
    await deletePending(id);
    return { ok: false, error: 'Too many incorrect attempts. Start sign-up again.' };
  }

  const expected = Buffer.from(row.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(String(code).trim()), 'hex');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    await bumpPendingAttempts(id, row);
    return { ok: false, error: 'Incorrect verification code.' };
  }

  if (await findUserByEmail(row.email)) {
    await deletePending(id);
    return { ok: false, error: 'An account with this email already exists.' };
  }
  if (await findUserByUsername(row.username)) {
    await deletePending(id);
    return { ok: false, error: 'That username is already taken.' };
  }

  const now = new Date().toISOString();
  const user = {
    id: randomBytes(12).toString('hex'),
    email: row.email,
    username: row.username,
    provider: row.provider,
    providerId: null,
    password: row.password,
    verified: true,
    rank: 1,
    rating: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (usePostgres) {
    await query(
      `INSERT INTO users
         (id, email, username, provider, provider_id, password, verified, rank, rating, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NULL,$5,TRUE,1,0,now(),now())`,
      [user.id, user.email, user.username, user.provider, JSON.stringify(user.password)],
    );
  } else {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
  }
  await deletePending(id);
  return { ok: true, user };
}

async function bumpPendingAttempts(id, row) {
  if (usePostgres) {
    await query('UPDATE pending_signups SET attempts = attempts + 1 WHERE id = $1', [id]);
    return;
  }
  const pending = readPending();
  if (pending[id]) {
    pending[id] = { ...row, attempts: row.attempts + 1 };
    writePending(pending);
  }
}

async function deletePending(id) {
  if (usePostgres) {
    await query('DELETE FROM pending_signups WHERE id = $1', [id]);
    return;
  }
  const pending = readPending();
  if (pending[id]) {
    delete pending[id];
    writePending(pending);
  }
}

/* ------------------------------------------------------------------ *
 * OAuth upsert                                                       *
 * ------------------------------------------------------------------ */

/** Upsert a verified user created via OAuth (Google / Microsoft). */
export async function upsertOAuthUser({ email, username, provider, providerId }) {
  const key = email.trim().toLowerCase();
  const now = new Date().toISOString();

  if (usePostgres) {
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 OR (provider = $2 AND provider_id = $3) LIMIT 1',
      [key, provider, providerId],
    );
    const existing = mapUser(rows[0]);
    if (existing) {
      const { rows: updated } = await query(
        `UPDATE users
           SET email = $2, username = $3, provider = $4, provider_id = $5, verified = TRUE, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [existing.id, key, existing.username || username, provider, providerId],
      );
      return mapUser(updated[0]);
    }
    const uname = await uniqueUsername(username, key);
    const id = randomBytes(12).toString('hex');
    const { rows: created } = await query(
      `INSERT INTO users
         (id, email, username, provider, provider_id, password, verified, rank, rating, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NULL,TRUE,1,0,now(),now()) RETURNING *`,
      [id, key, uname, provider, providerId],
    );
    return mapUser(created[0]);
  }

  const users = readUsers();
  let user = users.find((u) => u.email === key || (u.provider === provider && u.providerId === providerId));
  if (user) {
    user = { ...user, email: key, username: user.username || username, provider, providerId, verified: true, updatedAt: now };
    users[users.findIndex((u) => u.id === user.id)] = user;
  } else {
    const uname = await uniqueUsername(username, key);
    user = {
      id: randomBytes(12).toString('hex'),
      email: key,
      username: uname,
      provider,
      providerId,
      password: null,
      verified: true,
      rank: 1,
      rating: 0,
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
  }
  writeUsers(users);
  return user;
}

async function uniqueUsername(raw, emailKey) {
  let uname = String(raw || '').trim().slice(0, 24) || emailKey.split('@')[0].slice(0, 24);
  uname = uname.replace(/[^a-zA-Z0-9_]/g, '_') || 'player';
  if (await findUserByUsername(uname)) uname = `${uname.slice(0, 18)}_${randomBytes(2).toString('hex')}`;
  return uname;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    provider: user.provider ?? null,
    verified: !!user.verified,
    rank: user.rank ?? 1,
    rating: user.rating ?? 0,
    createdAt: user.createdAt,
  };
}

/* ------------------------------------------------------------------ *
 * Sessions                                                           *
 * ------------------------------------------------------------------ */

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  if (usePostgres) {
    await query(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)',
      [token, userId, now, expiresAt],
    );
    return token;
  }
  const sessions = readSessions();
  sessions[token] = { userId, createdAt: now, expiresAt };
  writeSessions(sessions);
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  if (usePostgres) {
    const { rows } = await query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token]);
    const row = rows[0];
    if (!row) return null;
    if (Date.now() > Number(row.expires_at)) {
      await query('DELETE FROM sessions WHERE token = $1', [token]);
      return null;
    }
    return findUserById(row.user_id);
  }
  const sessions = readSessions();
  const session = sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    writeSessions(sessions);
    return null;
  }
  return findUserById(session.userId);
}

export async function destroySession(token) {
  if (!token) return;
  if (usePostgres) {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    return;
  }
  const sessions = readSessions();
  if (sessions[token]) {
    delete sessions[token];
    writeSessions(sessions);
  }
}

/* ------------------------------------------------------------------ *
 * Uploads (admin file manager)                                       *
 * ------------------------------------------------------------------ */

export async function saveUpload({ filename, mime, size, data, uploadedBy = null }) {
  const id = randomBytes(12).toString('hex');
  const createdAt = new Date().toISOString();
  if (usePostgres) {
    await query(
      'INSERT INTO uploads (id, filename, mime, size, data, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, filename, mime, size, data, uploadedBy],
    );
    return { id, filename, mime, size, uploadedBy, createdAt };
  }
  ensureStore();
  writeFileSync(join(UPLOADS_DIR, id), data);
  const rows = readUploads();
  rows.push({ id, filename, mime, size, uploadedBy, createdAt });
  writeUploads(rows);
  return { id, filename, mime, size, uploadedBy, createdAt };
}

export async function getUpload(id) {
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM uploads WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      size: Number(row.size),
      data: row.data,
      createdAt: iso(row.created_at),
    };
  }
  const meta = readUploads().find((u) => u.id === id);
  if (!meta) return null;
  const path = join(UPLOADS_DIR, id);
  if (!existsSync(path)) return null;
  return { ...meta, data: readFileSync(path) };
}

export async function listUploads() {
  if (usePostgres) {
    const { rows } = await query(
      'SELECT id, filename, mime, size, uploaded_by, created_at FROM uploads ORDER BY created_at DESC',
    );
    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mime: r.mime,
      size: Number(r.size),
      uploadedBy: r.uploaded_by,
      createdAt: iso(r.created_at),
    }));
  }
  return readUploads()
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function deleteUpload(id) {
  if (usePostgres) {
    const { rowCount } = await query('DELETE FROM uploads WHERE id = $1', [id]);
    return rowCount > 0;
  }
  const rows = readUploads();
  const idx = rows.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  writeUploads(rows);
  const path = join(UPLOADS_DIR, id);
  if (existsSync(path)) rmSync(path);
  return true;
}

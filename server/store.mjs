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
const AVATARS_DIR = join(DATA_DIR, 'avatars');
const UPLOADS_FILE = join(DATA_DIR, 'uploads.json');
const AUDIT_FILE = join(DATA_DIR, 'admin-audit.json');
const REPORTS_FILE = join(DATA_DIR, 'admin-reports.json');
const ANNOUNCEMENTS_FILE = join(DATA_DIR, 'admin-announcements.json');
const SETTINGS_FILE = join(DATA_DIR, 'admin-settings.json');

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_ACTIVE_MS = 5 * 60 * 1000;

const DEFAULT_SETTINGS = {
  maintenance: false,
  registration: true,
  events: true,
  shop: true,
  notifications: true,
};

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
  if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, '[]\n', 'utf8');
  if (!existsSync(SESSIONS_FILE)) writeFileSync(SESSIONS_FILE, '{}\n', 'utf8');
  if (!existsSync(PENDING_FILE)) writeFileSync(PENDING_FILE, '{}\n', 'utf8');
  if (!existsSync(UPLOADS_FILE)) writeFileSync(UPLOADS_FILE, '[]\n', 'utf8');
  if (!existsSync(AUDIT_FILE)) writeFileSync(AUDIT_FILE, '[]\n', 'utf8');
  if (!existsSync(REPORTS_FILE)) writeFileSync(REPORTS_FILE, '[]\n', 'utf8');
  if (!existsSync(ANNOUNCEMENTS_FILE)) writeFileSync(ANNOUNCEMENTS_FILE, '[]\n', 'utf8');
  if (!existsSync(SETTINGS_FILE)) writeFileSync(SETTINGS_FILE, `${JSON.stringify(DEFAULT_SETTINGS, null, 2)}\n`, 'utf8');
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
    passwordPlain: row.password_plain ?? row.passwordPlain ?? null,
    verified: !!row.verified,
    rank: row.rank ?? 1,
    rating: row.rating ?? 0,
    country: row.country ?? '',
    status: row.status || 'active',
    notes: row.notes ?? '',
    lastIp: row.last_ip ?? row.lastIp ?? '',
    lastSeen: iso(row.last_seen ?? row.lastSeen) || null,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? '',
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: iso(row.created_at ?? row.createdAt),
    updatedAt: iso(row.updated_at ?? row.updatedAt),
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
    passwordPlain: row.password_plain ?? row.passwordPlain ?? null,
    country: row.country ?? '',
    codeHash: row.code_hash ?? row.codeHash,
    attempts: row.attempts,
    emailStatus: row.email_status ?? row.emailStatus,
    emailError: row.email_error ?? row.emailError,
    createdAt: Number(row.created_at ?? row.createdAt),
    expiresAt: Number(row.expires_at ?? row.expiresAt),
  };
}

function normalizeCountry(value) {
  return String(value || '')
    .trim()
    .slice(0, 64);
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

function plainEqual(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Accepts plain-text vault passwords or legacy PBKDF2 records. */
export function verifyPassword(password, record) {
  if (record == null) return false;
  if (typeof record === 'string') return plainEqual(password, record);
  if (typeof record === 'object' && record.hash && record.salt) {
    const salt = Buffer.from(record.salt, 'base64');
    const expected = Buffer.from(record.hash, 'base64');
    const actual = pbkdf2Sync(password, salt, record.iterations, expected.length, 'sha256');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }
  return false;
}

/** Login check — prefers plain password fields used by the admin vault. */
export function verifyUserPassword(password, user) {
  if (!user) return false;
  if (user.passwordPlain != null && user.passwordPlain !== '') {
    return plainEqual(password, user.passwordPlain);
  }
  return verifyPassword(password, user.password);
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
  return mapUser(readUsers().find((u) => u.email === key));
}

export async function findUserByUsername(username) {
  const key = username.trim().toLowerCase();
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users WHERE lower(username) = $1', [key]);
    return mapUser(rows[0]);
  }
  return mapUser(readUsers().find((u) => u.username.toLowerCase() === key));
}

export async function findUserById(id) {
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return mapUser(rows[0]);
  }
  return mapUser(readUsers().find((u) => u.id === id));
}

/* ------------------------------------------------------------------ *
 * Pending signups (OTP)                                              *
 * ------------------------------------------------------------------ */

/** Create pending signup + 6-digit OTP. Account is NOT created until OTP succeeds. */
export async function createPendingSignup({
  email,
  username,
  password,
  provider = 'email',
  country = '',
}) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const id = randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;
  const key = email.trim().toLowerCase();
  const uname = username.trim();
  const pwd = String(password);
  const ctry = normalizeCountry(country);

  if (usePostgres) {
    await query('DELETE FROM pending_signups WHERE expires_at < $1 OR email = $2', [now, key]);
    await query(
      `INSERT INTO pending_signups
         (id, email, username, provider, password, password_plain, country, code_hash, attempts, email_status, email_error, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'sending',NULL,$9,$10)`,
      [id, key, uname, provider, JSON.stringify(pwd), pwd, ctry, hashOtp(code), now, expiresAt],
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
    passwordPlain: pwd,
    country: ctry,
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
    password: row.passwordPlain ?? (typeof row.password === 'string' ? row.password : null),
    passwordPlain: row.passwordPlain ?? (typeof row.password === 'string' ? row.password : null),
    verified: true,
    rank: 1,
    rating: 0,
    country: row.country || '',
    status: 'active',
    role: 'user',
    notes: '',
    lastIp: '',
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  };

  if (usePostgres) {
    await query(
      `INSERT INTO users
         (id, email, username, provider, provider_id, password, password_plain, verified, rank, rating,
          country, status, notes, last_ip, last_seen, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,TRUE,1,0,$7,'active','','',now(),now(),now())`,
      [
        user.id,
        user.email,
        user.username,
        user.provider,
        JSON.stringify(user.password),
        user.passwordPlain,
        user.country,
      ],
    );
  } else {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
  }
  await deletePending(id);
  return { ok: true, user };
}

/** Direct registration — no email OTP / SMTP. */
export async function registerUserDirect({
  email,
  username,
  password,
  provider = 'email',
  country = '',
  ip = '',
}) {
  const key = email.trim().toLowerCase();
  const uname = username.trim();
  if (await findUserByEmail(key)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }
  if (await findUserByUsername(uname)) {
    return { ok: false, error: 'That name is already taken.' };
  }

  const now = new Date().toISOString();
  const pwd = String(password);
  const user = {
    id: randomBytes(12).toString('hex'),
    email: key,
    username: uname,
    provider,
    providerId: null,
    password: pwd,
    passwordPlain: pwd,
    verified: true,
    rank: 1,
    rating: 0,
    country: String(country || '').slice(0, 64),
    status: 'active',
    role: 'user',
    notes: '',
    lastIp: String(ip || '').slice(0, 64),
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  };

  if (usePostgres) {
    await query(
      `INSERT INTO users
         (id, email, username, provider, provider_id, password, password_plain, verified, rank, rating,
          country, status, notes, last_ip, last_seen, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,TRUE,1,0,$7,'active','',$8,now(),now(),now())`,
      [
        user.id,
        user.email,
        user.username,
        user.provider,
        JSON.stringify(user.password),
        user.passwordPlain,
        user.country,
        user.lastIp,
      ],
    );
  } else {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
  }

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
export async function upsertOAuthUser({
  email,
  username,
  provider,
  providerId,
  country = '',
  ip = '',
  avatarUrl = '',
}) {
  const key = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const ctry = String(country || '').slice(0, 64);
  const lastIp = String(ip || '').slice(0, 64);
  const avatar = String(avatarUrl || '').slice(0, 1024);

  if (usePostgres) {
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 OR (provider = $2 AND provider_id = $3) LIMIT 1',
      [key, provider, providerId],
    );
    const existing = mapUser(rows[0]);
    if (existing) {
      const { rows: updated } = await query(
        `UPDATE users
           SET email = $2, username = $3, provider = $4, provider_id = $5, verified = TRUE,
               country = CASE WHEN $6 <> '' AND (country = '' OR country = 'Unknown' OR country = 'Local network') THEN $6 ELSE country END,
               last_ip = CASE WHEN $7 <> '' THEN $7 ELSE last_ip END,
               avatar_url = CASE WHEN $8 <> '' THEN $8 ELSE avatar_url END,
               last_seen = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [existing.id, key, existing.username || username, provider, providerId, ctry, lastIp, avatar],
      );
      return mapUser(updated[0]);
    }
    const uname = await uniqueUsername(username, key);
    const id = randomBytes(12).toString('hex');
    const { rows: created } = await query(
      `INSERT INTO users
         (id, email, username, provider, provider_id, password, password_plain, verified, rank, rating,
          country, status, notes, last_ip, last_seen, avatar_url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NULL,NULL,TRUE,1,0,$6,'active','',$7,now(),$8,now(),now()) RETURNING *`,
      [id, key, uname, provider, providerId, ctry, lastIp, avatar],
    );
    return mapUser(created[0]);
  }

  const users = readUsers();
  let user = users.find((u) => u.email === key || (u.provider === provider && u.providerId === providerId));
  if (user) {
    user = {
      ...user,
      email: key,
      username: user.username || username,
      provider,
      providerId,
      verified: true,
      country:
        ctry && (!user.country || user.country === 'Unknown' || user.country === 'Local network')
          ? ctry
          : user.country || ctry,
      lastIp: lastIp || user.lastIp || '',
      avatarUrl: avatar || user.avatarUrl || '',
      lastSeen: now,
      updatedAt: now,
    };
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
      passwordPlain: null,
      verified: true,
      rank: 1,
      rating: 0,
      country: ctry,
      status: 'active',
      role: 'user',
      notes: '',
      lastIp,
      avatarUrl: avatar,
      lastSeen: now,
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
    country: user.country || '',
    status: user.status || 'active',
    avatarUrl: user.avatarUrl || '',
    role: user.role === 'admin' ? 'admin' : 'user',
    createdAt: user.createdAt,
  };
}

/** Admin-facing user payload (includes password for control-plane visibility). */
export function adminUser(user, { onlineIds = new Set() } = {}) {
  if (!user) return null;
  const lastSeenMs = user.lastSeen ? Date.parse(user.lastSeen) : 0;
  const recentlyActive = lastSeenMs > 0 && Date.now() - lastSeenMs < RECENT_ACTIVE_MS;
  const live = onlineIds.has(user.id);
  let presence = 'offline';
  if (user.status === 'banned') presence = 'banned';
  else if (user.status === 'muted') presence = 'muted';
  else if (user.status === 'suspended') presence = 'suspended';
  else if (live || recentlyActive) presence = 'online';

  return {
    id: user.id,
    username: user.username,
    displayName: user.username,
    email: user.email,
    password:
      user.passwordPlain ||
      (typeof user.password === 'string' ? user.password : null) ||
      (user.password ? '(hashed — legacy account)' : '(OAuth / no password)'),
    hasPassword: Boolean(user.passwordPlain || user.password),
    provider: user.provider || 'email',
    country: user.country || 'Unknown',
    status: presence,
    accountStatus: user.status || 'active',
    verified: !!user.verified,
    rank: user.rank ?? 1,
    rating: user.rating ?? 0,
    registered: (user.createdAt || '').slice(0, 10),
    lastLogin: user.lastSeen ? String(user.lastSeen).replace('T', ' ').slice(0, 16) : '—',
    lastSeen: user.lastSeen,
    ip: user.lastIp || '—',
    notes: user.notes || '',
    online: live,
    role: user.role === 'admin' ? 'admin' : 'user',
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
 * User avatars (OAuth profile photos)                                *
 * ------------------------------------------------------------------ */

export function persistUserAvatar(userId, data, mime = 'image/jpeg') {
  ensureStore();
  const id = String(userId).replace(/[^a-zA-Z0-9]/g, '');
  if (!id || !data?.length) return '';
  const ext = /png/i.test(mime) ? 'png' : /webp/i.test(mime) ? 'webp' : 'jpg';
  for (const e of ['jpg', 'jpeg', 'png', 'webp']) {
    const p = join(AVATARS_DIR, `${id}.${e}`);
    if (existsSync(p) && e !== ext) {
      try {
        rmSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  writeFileSync(join(AVATARS_DIR, `${id}.${ext}`), data);
  return `/api/avatars/${id}`;
}

export function getAvatarFile(userId) {
  ensureStore();
  const id = String(userId || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!id) return null;
  for (const [ext, mime] of [
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ]) {
    const path = join(AVATARS_DIR, `${id}.${ext}`);
    if (existsSync(path)) return { path, mime };
  }
  return null;
}

export async function setUserAvatarUrl(userId, avatarUrl) {
  const url = String(avatarUrl || '').slice(0, 1024);
  if (!url) return findUserById(userId);
  if (usePostgres) {
    const { rows } = await query(
      `UPDATE users SET avatar_url = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [userId, url],
    );
    return mapUser(rows[0]);
  }
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], avatarUrl: url, updatedAt: new Date().toISOString() };
  writeUsers(users);
  return mapUser(users[idx]);
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

/* ------------------------------------------------------------------ *
 * Activity / admin user management                                   *
 * ------------------------------------------------------------------ */

export async function touchUserActivity(userId, { ip = '' } = {}) {
  if (!userId) return null;
  const now = new Date().toISOString();
  if (usePostgres) {
    const { rows } = await query(
      `UPDATE users
         SET last_seen = now(),
             last_ip = CASE WHEN $2 <> '' THEN $2 ELSE last_ip END,
             updated_at = now()
       WHERE id = $1 RETURNING *`,
      [userId, String(ip || '')],
    );
    return mapUser(rows[0]);
  }
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    lastSeen: now,
    lastIp: ip || users[idx].lastIp || '',
    updatedAt: now,
  };
  writeUsers(users);
  return mapUser(users[idx]);
}

export async function listUsers() {
  if (usePostgres) {
    const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(mapUser);
  }
  return readUsers()
    .map(mapUser)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function updateUserAdmin(userId, patch = {}) {
  const user = await findUserById(userId);
  if (!user) return null;

  const next = {
    status: patch.status ?? user.status ?? 'active',
    country: patch.country !== undefined ? normalizeCountry(patch.country) : user.country || '',
    notes: patch.notes !== undefined ? String(patch.notes).slice(0, 2000) : user.notes || '',
    username: patch.username !== undefined ? String(patch.username).trim().slice(0, 24) : user.username,
    role:
      patch.role !== undefined
        ? patch.role === 'admin'
          ? 'admin'
          : 'user'
        : user.role === 'admin'
          ? 'admin'
          : 'user',
  };

  if (patch.password) {
    const pwd = String(patch.password);
    next.password = pwd;
    next.passwordPlain = pwd;
  }

  if (usePostgres) {
    const params = [userId, next.status, next.country, next.notes, next.username, next.role];
    let sql = `UPDATE users SET status=$2, country=$3, notes=$4, username=$5, role=$6, updated_at=now()`;
    if (next.passwordPlain != null && patch.password) {
      sql += `, password=$7, password_plain=$8`;
      params.push(JSON.stringify(next.password), next.passwordPlain);
    }
    sql += ` WHERE id=$1 RETURNING *`;
    const { rows } = await query(sql, params);
    return mapUser(rows[0]);
  }

  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    ...next,
    updatedAt: new Date().toISOString(),
  };
  writeUsers(users);
  return mapUser(users[idx]);
}

export async function destroySessionsForUser(userId) {
  const uid = String(userId || '');
  if (!uid) return;
  if (usePostgres) {
    await query('DELETE FROM sessions WHERE user_id = $1', [uid]);
    return;
  }
  const sessions = readSessions();
  let changed = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (s?.userId === uid) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) writeSessions(sessions);
}

export async function getAdminStats(onlineIds = new Set()) {
  const users = await listUsers();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const onlineUsers = users.filter((u) => {
    if (u.status === 'banned' || u.status === 'suspended') return false;
    if (onlineIds.has(u.id)) return true;
    const t = u.lastSeen ? Date.parse(u.lastSeen) : 0;
    return t > now - RECENT_ACTIVE_MS;
  }).length;
  const newRegistrations = users.filter((u) => Date.parse(u.createdAt) > dayAgo).length;
  const dau = users.filter((u) => {
    const t = u.lastSeen ? Date.parse(u.lastSeen) : 0;
    return t > dayAgo;
  }).length;
  const bannedUsers = users.filter((u) => u.status === 'banned').length;
  const reports = await listReports();
  const announcements = await listAnnouncements();
  const audit = await listAudit(1);
  return {
    totalUsers: users.length,
    onlineUsers,
    newRegistrations,
    dau,
    bannedUsers,
    moderators: 1,
    openReports: reports.filter((r) => r.status === 'open').length,
    announcements: announcements.length,
    auditEntries: (await listAudit(500)).length,
    serverStatus: 'Healthy',
    latestAudit: audit[0] || null,
  };
}

export async function getAnalytics(onlineIds = new Set()) {
  const users = await listUsers();
  const days = 14;
  const growth = [];
  const dauSeries = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const created = users.filter((u) => {
      const t = Date.parse(u.createdAt);
      return t >= day.getTime() && t < next.getTime();
    }).length;
    const active = users.filter((u) => {
      const t = u.lastSeen ? Date.parse(u.lastSeen) : 0;
      return t >= day.getTime() && t < next.getTime();
    }).length;
    growth.push(created);
    dauSeries.push(active);
  }
  const stats = await getAdminStats(onlineIds);
  return { growth, dauSeries, ...stats };
}

/* ------------------------------------------------------------------ *
 * Admin audit / reports / announcements / settings                   *
 * ------------------------------------------------------------------ */

export async function appendAudit({ admin, action, target = '', reason = '', ip = '' }) {
  const entry = {
    id: `A-${randomBytes(6).toString('hex')}`,
    admin: String(admin || 'admin'),
    action: String(action || ''),
    target: String(target || ''),
    reason: String(reason || ''),
    ip: String(ip || ''),
    at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    createdAt: new Date().toISOString(),
  };
  if (usePostgres) {
    await query(
      `INSERT INTO admin_audit (id, admin, action, target, reason, ip) VALUES ($1,$2,$3,$4,$5,$6)`,
      [entry.id, entry.admin, entry.action, entry.target, entry.reason, entry.ip],
    );
    return entry;
  }
  const rows = readJson(AUDIT_FILE, []);
  rows.unshift(entry);
  writeJson(AUDIT_FILE, rows.slice(0, 1000));
  return entry;
}

export async function listAudit(limit = 200) {
  if (usePostgres) {
    const { rows } = await query(
      `SELECT id, admin, action, target, reason, ip, created_at
       FROM admin_audit ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      admin: r.admin,
      action: r.action,
      target: r.target,
      reason: r.reason,
      ip: r.ip,
      at: iso(r.created_at)?.replace('T', ' ').slice(0, 16) || '',
    }));
  }
  return readJson(AUDIT_FILE, []).slice(0, limit);
}

export async function listReports() {
  if (usePostgres) {
    const { rows } = await query(
      `SELECT id, reporter, target, category, status, note, created_at
       FROM admin_reports ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      reporter: r.reporter,
      target: r.target,
      category: r.category,
      status: r.status,
      note: r.note,
      created: iso(r.created_at)?.slice(0, 10) || '',
    }));
  }
  return readJson(REPORTS_FILE, []);
}

export async function createReport({ reporter, target, category, note = '' }) {
  const row = {
    id: `R-${randomBytes(4).toString('hex')}`,
    reporter: String(reporter || 'system'),
    target: String(target || ''),
    category: String(category || 'other'),
    status: 'open',
    note: String(note || ''),
    created: new Date().toISOString().slice(0, 10),
  };
  if (usePostgres) {
    await query(
      `INSERT INTO admin_reports (id, reporter, target, category, status, note)
       VALUES ($1,$2,$3,$4,'open',$5)`,
      [row.id, row.reporter, row.target, row.category, row.note],
    );
    return row;
  }
  const rows = readJson(REPORTS_FILE, []);
  rows.unshift(row);
  writeJson(REPORTS_FILE, rows);
  return row;
}

export async function updateReport(id, status, note = '') {
  if (usePostgres) {
    const { rows } = await query(
      `UPDATE admin_reports SET status=$2, note=CASE WHEN $3='' THEN note ELSE $3 END
       WHERE id=$1 RETURNING id, reporter, target, category, status, note, created_at`,
      [id, status, note],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      reporter: r.reporter,
      target: r.target,
      category: r.category,
      status: r.status,
      note: r.note,
      created: iso(r.created_at)?.slice(0, 10) || '',
    };
  }
  const rows = readJson(REPORTS_FILE, []);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], status, note: note || rows[idx].note };
  writeJson(REPORTS_FILE, rows);
  return rows[idx];
}

export async function listAnnouncements() {
  if (usePostgres) {
    const { rows } = await query(
      `SELECT id, title, body, audience, published_by, created_at
       FROM admin_announcements ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      audience: r.audience,
      publishedBy: r.published_by,
      created: iso(r.created_at)?.replace('T', ' ').slice(0, 16) || '',
    }));
  }
  return readJson(ANNOUNCEMENTS_FILE, []);
}

export async function createAnnouncement({ title, body = '', audience = 'Everyone', publishedBy = '' }) {
  const row = {
    id: `N-${randomBytes(4).toString('hex')}`,
    title: String(title || '').trim(),
    body: String(body || '').trim(),
    audience: String(audience || 'Everyone').trim(),
    publishedBy: String(publishedBy || ''),
    created: new Date().toISOString().replace('T', ' ').slice(0, 16),
  };
  if (!row.title) return null;
  if (usePostgres) {
    await query(
      `INSERT INTO admin_announcements (id, title, body, audience, published_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [row.id, row.title, row.body, row.audience, row.publishedBy],
    );
    return row;
  }
  const rows = readJson(ANNOUNCEMENTS_FILE, []);
  rows.unshift(row);
  writeJson(ANNOUNCEMENTS_FILE, rows);
  return row;
}

export async function getSettings() {
  if (usePostgres) {
    const { rows } = await query('SELECT key, value FROM admin_settings');
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      out[r.key] = r.value?.value ?? r.value;
    }
    return out;
  }
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, {}) };
}

export async function updateSettings(patch = {}) {
  const current = await getSettings();
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  }
  if (usePostgres) {
    for (const [key, value] of Object.entries(next)) {
      await query(
        `INSERT INTO admin_settings (key, value) VALUES ($1,$2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify({ value })],
      );
    }
    return next;
  }
  writeJson(SETTINGS_FILE, next);
  return next;
}

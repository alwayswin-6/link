import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomInt, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, '[]\n', 'utf8');
  if (!existsSync(SESSIONS_FILE)) writeFileSync(SESSIONS_FILE, '{}\n', 'utf8');
  if (!existsSync(PENDING_FILE)) writeFileSync(PENDING_FILE, '{}\n', 'utf8');
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

function readUsers() {
  return readJson(USERS_FILE, []);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function readSessions() {
  return readJson(SESSIONS_FILE, {});
}

function writeSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

function readPending() {
  return readJson(PENDING_FILE, {});
}

function writePending(pending) {
  writeJson(PENDING_FILE, pending);
}

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

export function findUserByEmail(email) {
  const key = email.trim().toLowerCase();
  return readUsers().find((u) => u.email === key) ?? null;
}

export function findUserByUsername(username) {
  const key = username.trim().toLowerCase();
  return readUsers().find((u) => u.username.toLowerCase() === key) ?? null;
}

export function findUserById(id) {
  return readUsers().find((u) => u.id === id) ?? null;
}

/** Create pending signup + 6-digit OTP. Account is NOT created until OTP succeeds. */
export function createPendingSignup({ email, username, password, provider = 'email' }) {
  const pending = readPending();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const id = randomBytes(16).toString('hex');
  const now = Date.now();

  // Drop expired / same-email pending rows
  for (const [key, row] of Object.entries(pending)) {
    if (row.expiresAt < now || row.email === email.trim().toLowerCase()) {
      delete pending[key];
    }
  }

  pending[id] = {
    id,
    email: email.trim().toLowerCase(),
    username: username.trim(),
    provider,
    password: hashPassword(password),
    codeHash: hashOtp(code),
    attempts: 0,
    emailStatus: 'sending',
    emailError: null,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
  };
  writePending(pending);
  return { id, code, email: pending[id].email, username: pending[id].username, expiresAt: pending[id].expiresAt };
}

export function setPendingEmailStatus(id, status, error = null) {
  const pending = readPending();
  if (!pending[id]) return null;
  pending[id] = {
    ...pending[id],
    emailStatus: status,
    emailError: error,
  };
  writePending(pending);
  return pending[id];
}

export function getPending(id) {
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

export function resendPendingOtp(id) {
  const pending = readPending();
  const row = pending[id];
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    delete pending[id];
    writePending(pending);
    return null;
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  pending[id] = {
    ...row,
    codeHash: hashOtp(code),
    attempts: 0,
    emailStatus: 'sending',
    emailError: null,
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  writePending(pending);
  return { id, code, email: row.email, username: row.username, expiresAt: pending[id].expiresAt };
}

/** Upsert a verified user created via OAuth (Google / Microsoft). */
export function upsertOAuthUser({ email, username, provider, providerId }) {
  const users = readUsers();
  const key = email.trim().toLowerCase();
  let user = users.find((u) => u.email === key || (u.provider === provider && u.providerId === providerId));
  const now = new Date().toISOString();
  if (user) {
    user = {
      ...user,
      email: key,
      username: user.username || username,
      provider,
      providerId,
      verified: true,
      updatedAt: now,
    };
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx] = user;
  } else {
    let uname = username.trim().slice(0, 24) || key.split('@')[0].slice(0, 24);
    uname = uname.replace(/[^a-zA-Z0-9_]/g, '_') || 'player';
    if (findUserByUsername(uname)) uname = `${uname.slice(0, 18)}_${randomBytes(2).toString('hex')}`;
    user = {
      id: randomBytes(12).toString('hex'),
      email: key,
      username: uname,
      provider,
      providerId,
      password: null,
      verified: true,
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
  }
  writeUsers(users);
  return user;
}

export function confirmPendingSignup(id, code) {
  const pending = readPending();
  const row = pending[id];
  if (!row) return { ok: false, error: 'Verification expired. Start sign-up again.' };
  if (Date.now() > row.expiresAt) {
    delete pending[id];
    writePending(pending);
    return { ok: false, error: 'Verification code expired. Start sign-up again.' };
  }
  if (row.attempts >= 5) {
    delete pending[id];
    writePending(pending);
    return { ok: false, error: 'Too many incorrect attempts. Start sign-up again.' };
  }

  const expected = Buffer.from(row.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(String(code).trim()), 'hex');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    pending[id] = { ...row, attempts: row.attempts + 1 };
    writePending(pending);
    return { ok: false, error: 'Incorrect verification code.' };
  }

  if (findUserByEmail(row.email)) {
    delete pending[id];
    writePending(pending);
    return { ok: false, error: 'An account with this email already exists.' };
  }
  if (findUserByUsername(row.username)) {
    delete pending[id];
    writePending(pending);
    return { ok: false, error: 'That username is already taken.' };
  }

  const users = readUsers();
  const now = new Date().toISOString();
  const user = {
    id: randomBytes(12).toString('hex'),
    email: row.email,
    username: row.username,
    provider: row.provider,
    password: row.password,
    verified: true,
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  writeUsers(users);
  delete pending[id];
  writePending(pending);
  return { ok: true, user };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    provider: user.provider ?? null,
    verified: !!user.verified,
    createdAt: user.createdAt,
  };
}

export function createSession(userId) {
  const sessions = readSessions();
  const token = randomBytes(32).toString('hex');
  sessions[token] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  writeSessions(sessions);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
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

export function destroySession(token) {
  if (!token) return;
  const sessions = readSessions();
  if (sessions[token]) {
    delete sessions[token];
    writeSessions(sessions);
  }
}

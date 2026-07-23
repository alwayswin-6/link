import pg from 'pg';

/**
 * PostgreSQL connection + schema.
 *
 * When DATABASE_URL is present (e.g. the Render PostgreSQL add-on) the whole
 * backend persists to Postgres. Without it (local dev), store.mjs falls back to
 * JSON files, so `pool` stays null and none of this runs.
 */
const { Pool } = pg;

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export const usePostgres = Boolean(CONNECTION_STRING);

function sslOption() {
  const flag = (process.env.DATABASE_SSL || '').toLowerCase();
  if (flag === 'disable' || flag === 'false') return false;
  if (/localhost|127\.0\.0\.1/.test(CONNECTION_STRING) && flag !== 'require') return false;
  return { rejectUnauthorized: false };
}

export const pool = usePostgres
  ? new Pool({ connectionString: CONNECTION_STRING, ssl: sslOption(), max: 8 })
  : null;

export function query(text, params) {
  if (!pool) throw new Error('PostgreSQL is not configured (DATABASE_URL missing).');
  return pool.query(text, params);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  username       TEXT NOT NULL,
  provider       TEXT,
  provider_id    TEXT,
  password       JSONB,
  password_plain TEXT,
  verified       BOOLEAN NOT NULL DEFAULT FALSE,
  rank           INTEGER NOT NULL DEFAULT 1,
  rating         INTEGER NOT NULL DEFAULT 0,
  country        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active',
  notes          TEXT NOT NULL DEFAULT '',
  last_ip        TEXT NOT NULL DEFAULT '',
  last_seen      TIMESTAMPTZ,
  avatar_url     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS pending_signups (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  username       TEXT NOT NULL,
  provider       TEXT NOT NULL DEFAULT 'email',
  password       JSONB,
  password_plain TEXT,
  country        TEXT NOT NULL DEFAULT '',
  code_hash      TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 0,
  email_status   TEXT,
  email_error    TEXT,
  created_at     BIGINT NOT NULL,
  expires_at     BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id           TEXT PRIMARY KEY,
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size         BIGINT NOT NULL,
  data         BYTEA NOT NULL,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id         TEXT PRIMARY KEY,
  admin      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  reason     TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_reports (
  id         TEXT PRIMARY KEY,
  reporter   TEXT NOT NULL,
  target     TEXT NOT NULL,
  category   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  audience   TEXT NOT NULL DEFAULT 'Everyone',
  published_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS download_events (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  user_id    TEXT NOT NULL DEFAULT '',
  username   TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS download_events_kind_idx ON download_events (kind);
CREATE INDEX IF NOT EXISTS download_events_created_idx ON download_events (created_at DESC);
`;

const MIGRATIONS = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
`;

let ready = null;

/** Create tables if missing. Safe to call repeatedly; runs once per process. */
export function initDb() {
  if (!pool) return Promise.resolve(false);
  if (!ready) {
    ready = pool
      .query(SCHEMA)
      .then(() => pool.query(MIGRATIONS))
      .then(() => {
        console.log('[db] PostgreSQL schema ready');
        return true;
      })
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

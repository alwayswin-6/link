import seed from './generated/admin-seed.json';

const SESSION_KEY = 'link-admin-session-v1';
const IDLE_MS = 30 * 60 * 1000; // 30 minutes

export type AdminRole =
  | 'super_admin'
  | 'administrator'
  | 'moderator'
  | 'support'
  | 'game_master';

export type Permission =
  | 'manage_users'
  | 'manage_reports'
  | 'manage_chat'
  | 'manage_events'
  | 'manage_shop'
  | 'manage_news'
  | 'manage_missions'
  | 'manage_leaderboards'
  | 'manage_settings'
  | 'view_analytics'
  | 'manage_roles'
  | 'manage_announcements'
  | 'view_audit';

export interface AdminSession {
  email: string;
  role: AdminRole;
  displayName: string;
  permissions: Permission[];
  issuedAt: number;
  lastActiveAt: number;
}

interface AdminSeed {
  version: number;
  email: string;
  algorithm: string;
  iterations: number;
  salt: string;
  hash: string;
  role: AdminRole;
  displayName: string;
  createdAt: string;
}

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'manage_users',
    'manage_reports',
    'manage_chat',
    'manage_events',
    'manage_shop',
    'manage_news',
    'manage_missions',
    'manage_leaderboards',
    'manage_settings',
    'view_analytics',
    'manage_roles',
    'manage_announcements',
    'view_audit',
  ],
  administrator: [
    'manage_users',
    'manage_reports',
    'manage_chat',
    'manage_events',
    'manage_shop',
    'manage_news',
    'manage_missions',
    'manage_leaderboards',
    'view_analytics',
    'manage_announcements',
    'view_audit',
  ],
  moderator: ['manage_reports', 'manage_chat', 'view_analytics', 'view_audit'],
  support: ['manage_users', 'manage_reports', 'view_audit'],
  game_master: [
    'manage_events',
    'manage_missions',
    'manage_leaderboards',
    'manage_users',
    'view_analytics',
  ],
};

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function pbkdf2Hash(password: string, saltB64: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return bufToB64(bits);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function getSeedEmail(): string {
  return (seed as AdminSeed).email;
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const s = seed as AdminSeed;
  if (email.trim().toLowerCase() !== s.email.toLowerCase()) return false;
  const computed = await pbkdf2Hash(password, s.salt, s.iterations);
  return timingSafeEqual(computed, s.hash);
}

export function createSession(): AdminSession {
  const s = seed as AdminSeed;
  const now = Date.now();
  const role = s.role;
  const session: AdminSession = {
    email: s.email,
    role,
    displayName: s.displayName,
    permissions: ROLE_PERMISSIONS[role] ?? [],
    issuedAt: now,
    lastActiveAt: now,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AdminSession;
    if (Date.now() - session.lastActiveAt > IDLE_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function touchSession(): void {
  const session = getSession();
  if (!session) return;
  session.lastActiveAt = Date.now();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasPermission(session: AdminSession | null, perm: Permission): boolean {
  if (!session) return false;
  return session.permissions.includes(perm);
}

export function roleLabel(role: AdminRole): string {
  const map: Record<AdminRole, string> = {
    super_admin: 'Super Administrator',
    administrator: 'Administrator',
    moderator: 'Moderator',
    support: 'Support Staff',
    game_master: 'Game Master',
  };
  return map[role];
}

import { getApiToken } from './files';

export interface AdminManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  hasPassword: boolean;
  provider: string;
  country: string;
  status: string;
  accountStatus: string;
  verified: boolean;
  rank: number;
  rating: number;
  registered: string;
  lastLogin: string;
  lastSeen: string | null;
  ip: string;
  notes: string;
  online: boolean;
  role?: 'user' | 'admin';
}

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  newRegistrations: number;
  dau: number;
  bannedUsers: number;
  moderators: number;
  openReports: number;
  announcements: number;
  auditEntries: number;
  serverStatus: string;
  liveConnections?: number;
}

export interface AuditEntry {
  id: string;
  admin: string;
  action: string;
  target: string;
  reason: string;
  at: string;
  ip: string;
}

export interface ReportItem {
  id: string;
  reporter: string;
  target: string;
  category: string;
  status: 'open' | 'resolved' | 'rejected';
  created: string;
  note: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedBy?: string;
  created: string;
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getApiToken();
  if (!token) throw new Error('Admin API session missing. Sign in again.');
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`/api/admin${path}`, { ...init, headers });
}

async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export async function fetchStats() {
  return adminJson<{ ok: true; stats: AdminStats; online: { id: string; username: string }[] }>('/stats');
}

export async function fetchAnalytics() {
  return adminJson<{
    ok: true;
    analytics: AdminStats & { growth: number[]; dauSeries: number[] };
  }>('/analytics');
}

export async function fetchUsers(q = '', status = 'all') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  const qs = params.toString();
  return adminJson<{ ok: true; users: AdminManagedUser[]; total: number }>(
    `/users${qs ? `?${qs}` : ''}`,
  );
}

export async function patchUser(
  id: string,
  body: Partial<{
    status: string;
    country: string;
    notes: string;
    username: string;
    password: string;
    reason: string;
    role: 'user' | 'admin';
  }>,
) {
  return adminJson<{ ok: true; user: AdminManagedUser }>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchChatRooms() {
  return adminJson<{ ok: true; rooms: { id: string; label: string; count: number }[] }>('/chat/rooms');
}

export async function fetchChatHistory(room: string, limit = 500) {
  const params = new URLSearchParams({ room, limit: String(limit) });
  return adminJson<{
    ok: true;
    room: string;
    messages: {
      id: string;
      from: string;
      fromName: string;
      to: string;
      text: string;
      imageUrl?: string;
      audioUrl?: string;
      ts: number;
    }[];
  }>(`/chat/history?${params}`);
}

export async function fetchAudit() {
  return adminJson<{ ok: true; entries: AuditEntry[] }>('/audit');
}

export async function fetchReports() {
  return adminJson<{ ok: true; reports: ReportItem[] }>('/reports');
}

export async function patchReport(id: string, status: 'resolved' | 'rejected', note = '') {
  return adminJson<{ ok: true; report: ReportItem }>(`/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

export async function fetchAnnouncements() {
  return adminJson<{ ok: true; announcements: AnnouncementItem[] }>('/announcements');
}

export async function publishAnnouncement(payload: { title: string; body: string; audience: string }) {
  return adminJson<{ ok: true; announcement: AnnouncementItem }>('/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSettings() {
  return adminJson<{ ok: true; settings: Record<string, boolean> }>('/settings');
}

export async function patchSettings(settings: Record<string, boolean>) {
  return adminJson<{ ok: true; settings: Record<string, boolean> }>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

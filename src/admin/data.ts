/** Shared admin types (live data is loaded from /api/admin). */

export type UserStatus = 'online' | 'offline' | 'banned' | 'muted' | 'suspended' | 'premium';

export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  country: string;
  status: UserStatus | string;
  accountStatus?: string;
  role?: string;
  registered: string;
  lastLogin: string;
  ip: string;
  notes?: string;
  provider?: string;
  online?: boolean;
  hasPassword?: boolean;
  rank?: number;
  rating?: number;
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

export const EMPTY_STATS = {
  totalUsers: 0,
  onlineUsers: 0,
  newRegistrations: 0,
  dau: 0,
  bannedUsers: 0,
  moderators: 1,
  openReports: 0,
  announcements: 0,
  auditEntries: 0,
  serverStatus: 'Healthy',
};

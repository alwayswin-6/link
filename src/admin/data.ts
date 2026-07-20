export type UserStatus = 'online' | 'offline' | 'banned' | 'muted' | 'suspended' | 'premium';

export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: UserStatus;
  role: 'player' | 'premium' | 'moderator' | 'banned';
  registered: string;
  lastLogin: string;
  ip: string;
  matches: number;
  balance: number;
  reports: number;
  clan: string;
  level: number;
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

export const STATS = {
  totalUsers: 148_220,
  onlineUsers: 3_842,
  newRegistrations: 612,
  dau: 18_940,
  bannedUsers: 421,
  moderators: 36,
  totalMatches: 2_184_550,
  totalTransactions: 96_430,
  serverStatus: 'Healthy',
  reports: 87,
  warnings: 214,
  supportTickets: 53,
  announcements: 4,
  systemLogs: 1_280,
};

export const USERS: ManagedUser[] = [
  {
    id: 'U-10042',
    username: 'shadowlink',
    displayName: 'ShadowLink',
    email: 'shadow@link.gg',
    status: 'online',
    role: 'premium',
    registered: '2025-11-02',
    lastLogin: '2026-07-20 08:12',
    ip: '102.44.18.9',
    matches: 285,
    balance: 12450,
    reports: 0,
    clan: 'LNK',
    level: 48,
  },
  {
    id: 'U-10088',
    username: 'neonx',
    displayName: 'NeonX',
    email: 'neonx@link.gg',
    status: 'online',
    role: 'moderator',
    registered: '2025-10-18',
    lastLogin: '2026-07-20 07:55',
    ip: '88.12.44.190',
    matches: 268,
    balance: 8200,
    reports: 1,
    clan: 'VYU',
    level: 44,
  },
  {
    id: 'U-10115',
    username: 'cybernull',
    displayName: 'CyberNull',
    email: 'null@link.gg',
    status: 'offline',
    role: 'player',
    registered: '2026-01-09',
    lastLogin: '2026-07-19 22:10',
    ip: '51.90.22.14',
    matches: 249,
    balance: 3100,
    reports: 0,
    clan: 'NUL',
    level: 41,
  },
  {
    id: 'U-10201',
    username: 'pulsefire',
    displayName: 'PulseFire',
    email: 'pulse@link.gg',
    status: 'muted',
    role: 'player',
    registered: '2026-02-14',
    lastLogin: '2026-07-20 01:02',
    ip: '193.22.8.77',
    matches: 231,
    balance: 900,
    reports: 3,
    clan: 'FIR',
    level: 37,
  },
  {
    id: 'U-10333',
    username: 'toxiclink',
    displayName: 'ToxicLink',
    email: 'toxic@mail.test',
    status: 'banned',
    role: 'banned',
    registered: '2026-03-01',
    lastLogin: '2026-06-12 14:40',
    ip: '45.77.201.3',
    matches: 88,
    balance: 0,
    reports: 12,
    clan: '—',
    level: 19,
  },
  {
    id: 'U-10450',
    username: 'buny',
    displayName: 'BUNY',
    email: 'buny@link.gg',
    status: 'premium',
    role: 'premium',
    registered: '2025-12-20',
    lastLogin: '2026-07-20 08:20',
    ip: '10.0.0.42',
    matches: 412,
    balance: 2450,
    reports: 0,
    clan: 'LNK',
    level: 52,
  },
  {
    id: 'U-10512',
    username: 'linkmaster',
    displayName: 'LinkMaster',
    email: 'lm@link.gg',
    status: 'offline',
    role: 'player',
    registered: '2026-04-08',
    lastLogin: '2026-07-18 19:33',
    ip: '72.14.201.99',
    matches: 210,
    balance: 1500,
    reports: 0,
    clan: 'LMX',
    level: 35,
  },
  {
    id: 'U-10600',
    username: 'newcomer',
    displayName: 'NewComer',
    email: 'new@link.gg',
    status: 'online',
    role: 'player',
    registered: '2026-07-19',
    lastLogin: '2026-07-20 08:01',
    ip: '201.44.9.18',
    matches: 4,
    balance: 100,
    reports: 0,
    clan: '—',
    level: 2,
  },
];

export const AUDIT: AuditEntry[] = [
  {
    id: 'A-9001',
    admin: 'linkadmin@admin.com',
    action: 'BAN_USER',
    target: 'toxiclink',
    reason: 'Repeated harassment reports',
    at: '2026-07-19 16:22',
    ip: '10.0.0.2',
  },
  {
    id: 'A-9002',
    admin: 'linkadmin@admin.com',
    action: 'MUTE_CHAT',
    target: 'pulsefire',
    reason: 'Spam in clan chat',
    at: '2026-07-20 01:15',
    ip: '10.0.0.2',
  },
  {
    id: 'A-9003',
    admin: 'linkadmin@admin.com',
    action: 'GRANT_CURRENCY',
    target: 'buny',
    reason: 'Event compensation',
    at: '2026-07-18 11:04',
    ip: '10.0.0.2',
  },
  {
    id: 'A-9004',
    admin: 'mod.neon@link.gg',
    action: 'RESOLVE_REPORT',
    target: 'R-440',
    reason: 'Insufficient evidence',
    at: '2026-07-17 09:40',
    ip: '88.12.44.190',
  },
];

export const REPORTS: ReportItem[] = [
  {
    id: 'R-512',
    reporter: 'shadowlink',
    target: 'toxiclink',
    category: 'Harassment',
    status: 'resolved',
    created: '2026-07-19',
    note: 'Permanent ban issued',
  },
  {
    id: 'R-530',
    reporter: 'neonx',
    target: 'pulsefire',
    category: 'Spam',
    status: 'open',
    created: '2026-07-20',
    note: '',
  },
  {
    id: 'R-531',
    reporter: 'cybernull',
    target: 'unknown_bot',
    category: 'Cheating',
    status: 'open',
    created: '2026-07-20',
    note: '',
  },
];

export const GROWTH = [42, 55, 48, 70, 66, 90, 84, 110, 102, 130, 148, 160];
export const DAU_SERIES = [12, 14, 13, 16, 18, 17, 19, 21, 20, 22, 23, 24];

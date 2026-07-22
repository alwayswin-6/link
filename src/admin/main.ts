import './admin.css';
import {
  clearSession,
  createSession,
  getSession,
  getSeedEmail,
  hasPermission,
  roleLabel,
  touchSession,
  verifyAdminCredentials,
  type AdminSession,
  type Permission,
} from './auth';
import { EMPTY_STATS, type ManagedUser } from './data';
import {
  fetchAnalytics,
  fetchAnnouncements,
  fetchAudit,
  fetchReports,
  fetchSettings,
  fetchStats,
  fetchUsers,
  patchReport,
  patchSettings,
  patchUser,
  publishAnnouncement,
  type AdminStats,
  type AnnouncementItem,
  type AuditEntry,
  type ReportItem,
} from './api';
import {
  bindFilesPage,
  renderFilesPage,
  serverAdminLogin,
  serverAdminLogout,
} from './files';

type Page =
  | 'overview'
  | 'users'
  | 'roles'
  | 'reports'
  | 'announcements'
  | 'analytics'
  | 'audit'
  | 'files'
  | 'settings';

const root = document.querySelector<HTMLDivElement>('#admin-root')!;
let session: AdminSession | null = getSession();
let page: Page = 'overview';
let userQuery = '';
let userFilter: 'all' | 'online' | 'offline' | 'banned' | 'muted' | 'suspended' | 'recent' = 'all';
let selectedUserId: string | null = null;
let toastTimer = 0;
let loading = false;

let stats: AdminStats = { ...EMPTY_STATS };
let users: ManagedUser[] = [];
let auditLog: AuditEntry[] = [];
let reports: ReportItem[] = [];
let announcements: AnnouncementItem[] = [];
let growth: number[] = [];
let dauSeries: number[] = [];
let settings: Record<string, boolean> = {
  maintenance: false,
  registration: true,
  events: true,
  shop: true,
  notifications: true,
};

const PAGE_PERMS: Partial<Record<Page, Permission>> = {
  users: 'manage_users',
  roles: 'manage_roles',
  reports: 'manage_reports',
  announcements: 'manage_announcements',
  analytics: 'view_analytics',
  audit: 'view_audit',
  settings: 'manage_settings',
};

function toast(msg: string): void {
  let el = document.querySelector<HTMLDivElement>('.admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el!.hidden = true;
  }, 2400);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

async function loadPageData(): Promise<void> {
  loading = true;
  try {
    if (page === 'overview') {
      const [s, a] = await Promise.all([fetchStats(), fetchAudit()]);
      stats = s.stats;
      auditLog = a.entries;
    } else if (page === 'users') {
      const data = await fetchUsers(userQuery, userFilter);
      users = data.users;
      if (!selectedUserId || !users.some((u) => u.id === selectedUserId)) {
        selectedUserId = users[0]?.id ?? null;
      }
    } else if (page === 'reports') {
      const data = await fetchReports();
      reports = data.reports;
    } else if (page === 'announcements') {
      const data = await fetchAnnouncements();
      announcements = data.announcements;
    } else if (page === 'analytics') {
      const data = await fetchAnalytics();
      growth = data.analytics.growth || [];
      dauSeries = data.analytics.dauSeries || [];
      stats = data.analytics;
    } else if (page === 'audit') {
      const data = await fetchAudit();
      auditLog = data.entries;
    } else if (page === 'settings') {
      const data = await fetchSettings();
      settings = data.settings;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load data';
    if (msg === 'unauthorized') {
      toast('Admin API session expired — sign in again');
      void serverAdminLogout();
      clearSession();
      session = null;
    } else {
      toast(msg);
    }
  } finally {
    loading = false;
  }
}

function renderLogin(): void {
  root.innerHTML = `
    <div class="admin-login">
      <form class="admin-login-card" id="admin-login-form" autocomplete="off">
        <h1>LINK ADMIN</h1>
        <p class="sub">Private control plane · Authorized personnel only</p>
        <div class="admin-field">
          <label for="admin-email">Administrator Email</label>
          <input id="admin-email" name="email" type="email" required autocomplete="username" />
        </div>
        <div class="admin-field">
          <label for="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" required autocomplete="current-password" />
        </div>
        <div class="admin-error" id="admin-login-error"></div>
        <button class="admin-btn" type="submit" id="admin-login-btn">AUTHENTICATE</button>
        <p class="admin-login-foot">
          This route is not linked from the public LINK experience.<br/>
          Sessions expire after 30 minutes of inactivity.
        </p>
      </form>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>('#admin-login-form')!;
  const err = root.querySelector<HTMLDivElement>('#admin-login-error')!;
  const btn = root.querySelector<HTMLButtonElement>('#admin-login-btn')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'VERIFYING…';
    const email = (root.querySelector<HTMLInputElement>('#admin-email')!.value || '').trim();
    const password = root.querySelector<HTMLInputElement>('#admin-password')!.value || '';
    try {
      const ok = await verifyAdminCredentials(email, password);
      if (!ok) {
        err.textContent = 'Invalid administrator credentials.';
        btn.disabled = false;
        btn.textContent = 'AUTHENTICATE';
        return;
      }
      const apiOk = await serverAdminLogin(email, password);
      if (!apiOk) {
        err.textContent = 'Server authentication failed. Ensure the API is running.';
        btn.disabled = false;
        btn.textContent = 'AUTHENTICATE';
        return;
      }
      session = createSession();
      page = 'overview';
      toast(`Welcome, ${session.displayName}`);
      await render();
    } catch {
      err.textContent = 'Authentication failed. Seed may be missing — run npm run seed:admin.';
      btn.disabled = false;
      btn.textContent = 'AUTHENTICATE';
    }
  });
}

function can(pageKey: Page): boolean {
  const perm = PAGE_PERMS[pageKey];
  if (!perm) return true;
  return hasPermission(session, perm);
}

function navBtn(id: Page, label: string): string {
  if (!can(id) && id !== 'overview') return '';
  return `<button type="button" class="admin-nav-btn${page === id ? ' active' : ''}" data-page="${id}">${label}</button>`;
}

function selectedUser(): ManagedUser | null {
  return users.find((u) => u.id === selectedUserId) ?? users[0] ?? null;
}

function chart(values: number[]): string {
  const max = Math.max(...values, 1);
  if (!values.length) {
    return `<div class="admin-chart"><i style="height:12%"></i></div>`;
  }
  return `<div class="admin-chart">${values
    .map((v) => `<i style="height:${Math.max(8, (v / max) * 100)}%"></i>`)
    .join('')}</div>`;
}

function renderOverview(): string {
  const cards = [
    ['Total Users', stats.totalUsers, 'Registered accounts'],
    ['Online Users', stats.onlineUsers, 'Live + recently active'],
    ['New Registrations', stats.newRegistrations, 'Last 24h'],
    ['Daily Active Users', stats.dau, 'Trailing day'],
    ['Banned Users', stats.bannedUsers, 'Active sanctions'],
    ['Open Reports', stats.openReports, 'Needs review'],
    ['Announcements', stats.announcements, 'Published'],
    ['Audit Entries', stats.auditEntries, 'Administrative history'],
    ['Server Status', stats.serverStatus, 'API health'],
    ['Live Connections', stats.liveConnections ?? 0, 'Chat WebSocket'],
  ] as const;

  return `
    <div class="admin-stats">
      ${cards
        .map(
          ([label, value, hint]) => `
        <article class="admin-stat">
          <div class="label">${label}</div>
          <div class="value">${typeof value === 'number' ? fmt(value) : escapeHtml(String(value))}</div>
          <div class="hint">${hint}</div>
        </article>`,
        )
        .join('')}
    </div>
    <div class="admin-grid-2">
      <section class="admin-panel">
        <h3>Platform Status</h3>
        <p style="color:#9b93b5;font-weight:600;line-height:1.6">
          Dashboard reflects live database records and chat presence.
          File Manager uploads are available to authenticated administrators.
        </p>
      </section>
      <section class="admin-panel">
        <h3>Recent Administrative Activity</h3>
        <ul class="admin-activity">
          ${
            auditLog.length
              ? auditLog
                  .slice(0, 8)
                  .map(
                    (a) => `
            <li>
              <span><strong>${escapeHtml(a.action)}</strong> → ${escapeHtml(a.target)}<br/><small style="color:#9b93b5">${escapeHtml(a.reason)}</small></span>
              <span class="meta">${escapeHtml(a.at)}</span>
            </li>`,
                  )
                  .join('')
              : `<li><span>No audit events yet</span><span class="meta">—</span></li>`
          }
        </ul>
      </section>
    </div>
  `;
}

function renderUsers(): string {
  const u = selectedUser();
  return `
    <div class="admin-toolbar">
      <div class="admin-search">
        <input id="user-search" type="search" placeholder="Search ID, username, email, country, password…" value="${escapeHtml(userQuery)}" />
      </div>
      ${(['all', 'online', 'offline', 'banned', 'muted', 'suspended', 'recent'] as const)
        .map(
          (f) =>
            `<button type="button" class="admin-chip${userFilter === f ? ' active' : ''}" data-filter="${f}">${f}</button>`,
        )
        .join('')}
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th><th>User</th><th>Email</th><th>Password</th><th>Country</th>
            <th>Status</th><th>Provider</th><th>IP</th><th>Last Login</th>
          </tr>
        </thead>
        <tbody>
          ${
            users.length
              ? users
                  .map(
                    (row) => `
            <tr data-user="${row.id}" class="${row.id === u?.id ? 'active' : ''}">
              <td>${escapeHtml(row.id)}</td>
              <td><strong>${escapeHtml(row.displayName)}</strong><br/><small style="color:#9b93b5">@${escapeHtml(row.username)}</small></td>
              <td>${escapeHtml(row.email)}</td>
              <td><code style="font-size:11px">${escapeHtml(row.password)}</code></td>
              <td>${escapeHtml(row.country || 'Unknown')}</td>
              <td><span class="badge ${row.status}">${escapeHtml(String(row.status))}</span></td>
              <td>${escapeHtml(row.provider || 'email')}</td>
              <td>${escapeHtml(row.ip || '—')}</td>
              <td>${escapeHtml(row.lastLogin)}</td>
            </tr>`,
                  )
                  .join('')
              : `<tr><td colspan="9" style="padding:24px;color:#9b93b5">No registered users yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
    ${
      u
        ? `
      <div class="admin-detail">
        <section class="admin-panel">
          <h3>User Profile · ${escapeHtml(u.displayName)}</h3>
          <dl class="admin-kv">
            <dt>User ID</dt><dd>${escapeHtml(u.id)}</dd>
            <dt>Username</dt><dd>@${escapeHtml(u.username)}</dd>
            <dt>Email</dt><dd>${escapeHtml(u.email)}</dd>
            <dt>Password</dt><dd><code>${escapeHtml(u.password)}</code></dd>
            <dt>Country</dt><dd>${escapeHtml(u.country || 'Unknown')}</dd>
            <dt>Status</dt><dd><span class="badge ${u.status}">${escapeHtml(String(u.status))}</span></dd>
            <dt>Account</dt><dd>${escapeHtml(u.accountStatus || 'active')}</dd>
            <dt>Provider</dt><dd>${escapeHtml(u.provider || 'email')}</dd>
            <dt>Registered</dt><dd>${escapeHtml(u.registered)}</dd>
            <dt>Last Login</dt><dd>${escapeHtml(u.lastLogin)}</dd>
            <dt>IP</dt><dd>${escapeHtml(u.ip || '—')}</dd>
            <dt>Rank / Rating</dt><dd>${u.rank ?? 1} / ${u.rating ?? 0}</dd>
          </dl>
          <label style="display:block;margin-top:14px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#9b93b5">ADMINISTRATIVE NOTES</label>
          <textarea class="admin-notes" id="admin-note" placeholder="Internal notes (not visible to players)…">${escapeHtml(u.notes || '')}</textarea>
          <div class="admin-actions" style="margin-top:10px">
            <button type="button" data-act="save-notes">Save Notes</button>
          </div>
        </section>
        <section class="admin-panel">
          <h3>Admin Actions</h3>
          <div class="admin-actions">
            <button type="button" data-act="set-password">Set / Reset Password</button>
            <button type="button" data-act="set-country">Set Country</button>
            <button type="button" data-act="mute">Mute Chat</button>
            <button type="button" data-act="suspend">Suspend</button>
            <button type="button" data-act="ban" class="danger">Ban Account</button>
            <button type="button" data-act="unban">Restore Account</button>
          </div>
        </section>
      </div>`
        : ''
    }
  `;
}

function renderRoles(): string {
  const roles = [
    ['Super Administrator', 'Full platform control including roles & settings'],
    ['Administrator', 'Users, content, economy, analytics'],
    ['Moderator', 'Reports, chat moderation, limited audit'],
    ['Support Staff', 'User assistance, report triage'],
    ['Game Master', 'Events, missions, leaderboards, rewards'],
  ];
  return `
    <section class="admin-panel">
      <h3>Role-Based Access Control</h3>
      <p style="color:#9b93b5;font-weight:600;margin-bottom:14px">
        Signed in as <strong style="color:#c084fc">${escapeHtml(roleLabel(session!.role))}</strong>
        · ${session!.permissions.length} permissions granted
      </p>
      <div class="admin-table-wrap">
        <table class="admin-table" style="min-width:0">
          <thead><tr><th>Role</th><th>Scope</th></tr></thead>
          <tbody>
            ${roles.map(([r, d]) => `<tr><td><strong>${r}</strong></td><td>${d}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <h3 style="margin-top:18px">Your Permissions</h3>
      <div class="admin-toolbar" style="margin-top:10px">
        ${session!.permissions.map((p) => `<span class="admin-chip active">${p.replace(/_/g, ' ')}</span>`).join('')}
      </div>
    </section>
  `;
}

function renderReports(): string {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table" style="min-width:700px">
        <thead>
          <tr><th>ID</th><th>Reporter</th><th>Target</th><th>Category</th><th>Status</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${
            reports.length
              ? reports
                  .map(
                    (r) => `
            <tr>
              <td>${escapeHtml(r.id)}</td>
              <td>${escapeHtml(r.reporter)}</td>
              <td>${escapeHtml(r.target)}</td>
              <td>${escapeHtml(r.category)}</td>
              <td><span class="badge ${r.status === 'open' ? 'muted' : r.status === 'resolved' ? 'online' : 'offline'}">${r.status}</span></td>
              <td>${escapeHtml(r.created)}</td>
              <td>
                <button type="button" class="admin-mini" data-report="${r.id}" data-ract="resolve">Resolve</button>
                <button type="button" class="admin-mini" data-report="${r.id}" data-ract="reject">Reject</button>
              </td>
            </tr>`,
                  )
                  .join('')
              : `<tr><td colspan="7" style="padding:24px;color:#9b93b5">No reports in queue.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAnnouncements(): string {
  return `
    <section class="admin-panel">
      <h3>Create Announcement</h3>
      <div class="admin-field"><label>Title</label><input id="ann-title" placeholder="Weekend rewards" /></div>
      <div class="admin-field"><label>Audience</label>
        <input id="ann-audience" list="ann-aud-list" placeholder="Everyone" />
        <datalist id="ann-aud-list">
          <option value="Everyone"/><option value="Premium users"/><option value="Moderators"/><option value="Administrators"/>
        </datalist>
      </div>
      <label style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#9b93b5">BODY</label>
      <textarea class="admin-notes" id="ann-body" placeholder="Announcement content…"></textarea>
      <div class="admin-actions">
        <button type="button" id="ann-send">Publish Announcement</button>
      </div>
    </section>
    <section class="admin-panel" style="margin-top:14px">
      <h3>Published</h3>
      <ul class="admin-activity">
        ${
          announcements.length
            ? announcements
                .map(
                  (a) => `
          <li>
            <span><strong>${escapeHtml(a.title)}</strong><br/><small style="color:#9b93b5">${escapeHtml(a.audience)} · ${escapeHtml(a.body.slice(0, 80))}</small></span>
            <span class="meta">${escapeHtml(a.created)}</span>
          </li>`,
                )
                .join('')
            : `<li><span>No announcements yet</span><span class="meta">—</span></li>`
        }
      </ul>
    </section>
  `;
}

function renderAnalytics(): string {
  return `
    <div class="admin-grid-2">
      <section class="admin-panel"><h3>New Registrations (14d)</h3>${chart(growth)}</section>
      <section class="admin-panel"><h3>Daily Active Users (14d)</h3>${chart(dauSeries)}</section>
    </div>
    <div class="admin-stats">
      <article class="admin-stat"><div class="label">Total Users</div><div class="value">${fmt(stats.totalUsers)}</div><div class="hint">Registered</div></article>
      <article class="admin-stat"><div class="label">Online Now</div><div class="value">${fmt(stats.onlineUsers)}</div><div class="hint">Presence + recent</div></article>
      <article class="admin-stat"><div class="label">DAU</div><div class="value">${fmt(stats.dau)}</div><div class="hint">Last 24h</div></article>
      <article class="admin-stat"><div class="label">Banned</div><div class="value">${fmt(stats.bannedUsers)}</div><div class="hint">Sanctions</div></article>
    </div>
  `;
}

function renderAudit(): string {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>ID</th><th>Administrator</th><th>Action</th><th>Target</th><th>Reason</th><th>When</th><th>IP</th></tr>
        </thead>
        <tbody>
          ${
            auditLog.length
              ? auditLog
                  .map(
                    (a) => `
            <tr>
              <td>${escapeHtml(a.id)}</td>
              <td>${escapeHtml(a.admin)}</td>
              <td>${escapeHtml(a.action)}</td>
              <td>${escapeHtml(a.target)}</td>
              <td>${escapeHtml(a.reason)}</td>
              <td>${escapeHtml(a.at)}</td>
              <td>${escapeHtml(a.ip)}</td>
            </tr>`,
                  )
                  .join('')
              : `<tr><td colspan="7" style="padding:24px;color:#9b93b5">No audit entries yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings(): string {
  const toggles: [string, string, string][] = [
    ['maintenance', 'Maintenance Mode', 'Block matchmaking & show banner'],
    ['registration', 'Open Registration', 'Allow new account creation'],
    ['events', 'Events Enabled', 'Limited-time modes'],
    ['shop', 'Shop Enabled', 'Purchases and currency sinks'],
    ['notifications', 'Push Notifications', 'Desktop / email fanout'],
  ];
  return `
    <div class="admin-settings">
      ${toggles
        .map(
          ([id, title, desc]) => `
        <div class="admin-toggle">
          <div><strong>${title}</strong><span>${desc}</span></div>
          <button type="button" class="admin-switch${settings[id] ? ' on' : ''}" data-toggle="${id}" aria-label="${title}"><i></i></button>
        </div>`,
        )
        .join('')}
    </div>
    <section class="admin-panel" style="margin-top:14px">
      <h3>Server Configuration</h3>
      <dl class="admin-kv">
        <dt>Attachment Max</dt><dd>25 MB</dd>
        <dt>Seed Email</dt><dd>${escapeHtml(getSeedEmail())}</dd>
        <dt>Storage</dt><dd>PostgreSQL or local JSON</dd>
      </dl>
    </section>
  `;
}

function pageTitle(): { title: string; sub: string } {
  const map: Record<Page, { title: string; sub: string }> = {
    overview: { title: 'Operations Overview', sub: 'Live platform health' },
    users: { title: 'User Management', sub: 'Registered accounts, credentials, countries, activity' },
    roles: { title: 'Roles & Permissions', sub: 'RBAC configuration' },
    reports: { title: 'Report Queue', sub: 'Review and resolve player reports' },
    announcements: { title: 'Announcements', sub: 'Broadcast to audiences' },
    analytics: { title: 'Analytics', sub: 'Growth and activity from real data' },
    audit: { title: 'Audit Log', sub: 'Administrative history' },
    files: { title: 'File Manager', sub: 'Upload files and share download URLs' },
    settings: { title: 'System Settings', sub: 'Maintenance, features, server config' },
  };
  return map[page];
}

function renderBody(): string {
  if (!can(page)) {
    return `<section class="admin-panel"><h3>Access denied</h3><p style="color:#9b93b5">Missing permission for this module.</p></section>`;
  }
  if (loading && page !== 'files' && page !== 'roles') {
    return `<section class="admin-panel"><h3>Loading…</h3><p style="color:#9b93b5">Fetching live data from the API.</p></section>`;
  }
  switch (page) {
    case 'overview':
      return renderOverview();
    case 'users':
      return renderUsers();
    case 'roles':
      return renderRoles();
    case 'reports':
      return renderReports();
    case 'announcements':
      return renderAnnouncements();
    case 'analytics':
      return renderAnalytics();
    case 'audit':
      return renderAudit();
    case 'files':
      return renderFilesPage();
    case 'settings':
      return renderSettings();
  }
}

function renderShell(): void {
  if (!session) return;
  const t = pageTitle();
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <div class="admin-brand">LINK ADMIN<span>CONTROL PLANE</span></div>
        ${navBtn('overview', 'Dashboard')}
        ${navBtn('users', 'Users')}
        ${navBtn('roles', 'Roles')}
        ${navBtn('reports', 'Reports')}
        ${navBtn('announcements', 'Announcements')}
        ${navBtn('analytics', 'Analytics')}
        ${navBtn('audit', 'Audit Log')}
        ${navBtn('files', 'File Manager')}
        ${navBtn('settings', 'Settings')}
        <div class="admin-side-foot">
          <div class="admin-who">${escapeHtml(session.displayName)}<small>${escapeHtml(roleLabel(session.role))}</small></div>
          <button type="button" class="admin-logout" id="admin-logout">Sign Out</button>
        </div>
      </aside>
      <main class="admin-main">
        <div class="admin-top">
          <div>
            <h2>${t.title}</h2>
            <p>${t.sub}</p>
          </div>
        </div>
        <div id="admin-page">${renderBody()}</div>
      </main>
    </div>
  `;
  bindShell();
}

function bindShell(): void {
  root.querySelectorAll<HTMLButtonElement>('.admin-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      page = btn.dataset.page as Page;
      void render();
    });
  });
  root.querySelector('#admin-logout')?.addEventListener('click', () => {
    void serverAdminLogout();
    clearSession();
    session = null;
    void render();
  });

  const search = root.querySelector<HTMLInputElement>('#user-search');
  let searchTimer = 0;
  search?.addEventListener('input', () => {
    userQuery = search.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void (async () => {
        await loadPageData();
        const pageEl = root.querySelector('#admin-page');
        if (pageEl) pageEl.innerHTML = renderUsers();
        bindUserPage();
      })();
    }, 250);
  });

  bindUserPage();
  bindReports();
  bindAnnouncements();
  bindSettings();
  if (page === 'files') bindFilesPage(root, toast);
}

function bindUserPage(): void {
  root.querySelectorAll<HTMLTableRowElement>('tr[data-user]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedUserId = row.dataset.user ?? null;
      const pageEl = root.querySelector('#admin-page');
      if (pageEl) pageEl.innerHTML = renderUsers();
      bindUserPage();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      userFilter = btn.dataset.filter as typeof userFilter;
      void (async () => {
        await loadPageData();
        const pageEl = root.querySelector('#admin-page');
        if (pageEl) pageEl.innerHTML = renderUsers();
        bindUserPage();
      })();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void (async () => {
        const u = selectedUser();
        if (!u || !hasPermission(session, 'manage_users')) {
          toast('Missing manage_users permission');
          return;
        }
        const act = btn.dataset.act!;
        try {
          if (act === 'save-notes') {
            const notes = root.querySelector<HTMLTextAreaElement>('#admin-note')?.value || '';
            await patchUser(u.id, { notes, reason: 'notes update' });
            toast('Notes saved');
          } else if (act === 'set-password') {
            const password = prompt('New password for this user (min 8 characters)', '');
            if (!password || password.length < 8) {
              toast('Password must be at least 8 characters');
              return;
            }
            await patchUser(u.id, { password, reason: 'admin password reset' });
            toast('Password updated');
          } else if (act === 'set-country') {
            const country = prompt('Country / region', u.country || '') ?? '';
            await patchUser(u.id, { country, reason: 'country update' });
            toast('Country updated');
          } else if (act === 'ban') {
            await patchUser(u.id, { status: 'banned', reason: prompt('Ban reason', 'violation') || 'ban' });
            toast('User banned');
          } else if (act === 'mute') {
            await patchUser(u.id, { status: 'muted', reason: prompt('Mute reason', 'chat mute') || 'mute' });
            toast('User muted');
          } else if (act === 'suspend') {
            await patchUser(u.id, {
              status: 'suspended',
              reason: prompt('Suspend reason', 'suspended') || 'suspend',
            });
            toast('User suspended');
          } else if (act === 'unban') {
            await patchUser(u.id, { status: 'active', reason: 'restored' });
            toast('User restored');
          }
          await loadPageData();
          const pageEl = root.querySelector('#admin-page');
          if (pageEl) pageEl.innerHTML = renderUsers();
          bindUserPage();
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Action failed');
        }
      })();
    });
  });
}

function bindReports(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-report]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void (async () => {
        if (!hasPermission(session, 'manage_reports')) return;
        const id = btn.dataset.report!;
        const ract = btn.dataset.ract === 'reject' ? 'rejected' : 'resolved';
        try {
          await patchReport(id, ract);
          toast(`Report ${id} marked ${ract}`);
          await loadPageData();
          const pageEl = root.querySelector('#admin-page');
          if (pageEl) pageEl.innerHTML = renderReports();
          bindReports();
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Update failed');
        }
      })();
    });
  });
}

function bindAnnouncements(): void {
  root.querySelector('#ann-send')?.addEventListener('click', () => {
    void (async () => {
      if (!hasPermission(session, 'manage_announcements')) return;
      const title = (root.querySelector<HTMLInputElement>('#ann-title')?.value || '').trim();
      const audience = (root.querySelector<HTMLInputElement>('#ann-audience')?.value || 'Everyone').trim();
      const body = (root.querySelector<HTMLTextAreaElement>('#ann-body')?.value || '').trim();
      if (!title) {
        toast('Title required');
        return;
      }
      try {
        await publishAnnouncement({ title, audience, body });
        toast(`Announcement published for ${audience}`);
        await loadPageData();
        const pageEl = root.querySelector('#admin-page');
        if (pageEl) pageEl.innerHTML = renderAnnouncements();
        bindAnnouncements();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Publish failed');
      }
    })();
  });
}

function bindSettings(): void {
  root.querySelectorAll<HTMLButtonElement>('.admin-switch').forEach((btn) => {
    btn.addEventListener('click', () => {
      void (async () => {
        if (!hasPermission(session, 'manage_settings')) return;
        const id = btn.dataset.toggle || '';
        const next = { ...settings, [id]: !btn.classList.contains('on') };
        try {
          const data = await patchSettings(next);
          settings = data.settings;
          btn.classList.toggle('on', !!settings[id]);
          toast(`Setting ${id} updated`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Settings update failed');
        }
      })();
    });
  });
}

async function render(): Promise<void> {
  session = getSession();
  if (!session) {
    renderLogin();
    return;
  }
  touchSession();
  if (page !== 'files' && page !== 'roles') {
    loading = true;
    renderShell();
    await loadPageData();
  }
  renderShell();
}

window.setInterval(() => {
  if (!getSession() && session) {
    session = null;
    toast('Session expired due to inactivity');
    void render();
  }
}, 60_000);

document.addEventListener('click', () => {
  if (getSession()) touchSession();
});
document.addEventListener('keydown', () => {
  if (getSession()) touchSession();
});

document.title = 'Secure Console';

void render();

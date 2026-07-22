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
import {
  AUDIT,
  DAU_SERIES,
  GROWTH,
  REPORTS,
  STATS,
  USERS,
  type ManagedUser,
  type UserStatus,
} from './data';
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
let userFilter: 'all' | UserStatus | 'moderator' | 'recent' = 'all';
let selectedUserId: string | null = USERS[0]?.id ?? null;
let auditLog = [...AUDIT];
let reports = [...REPORTS];
let users = USERS.map((u) => ({ ...u }));
let toastTimer = 0;

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
      // Also authenticate with the API so the file manager can upload (best-effort).
      await serverAdminLogin(email, password);
      session = createSession();
      page = 'overview';
      toast(`Welcome, ${session.displayName}`);
      render();
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

function filteredUsers(): ManagedUser[] {
  const q = userQuery.trim().toLowerCase();
  return users.filter((u) => {
    if (userFilter === 'recent') {
      if (u.registered < '2026-07-01') return false;
    } else if (userFilter === 'moderator') {
      if (u.role !== 'moderator') return false;
    } else if (userFilter !== 'all' && u.status !== userFilter) {
      return false;
    }
    if (!q) return true;
    return `${u.id} ${u.username} ${u.displayName} ${u.email} ${u.clan} ${u.role} ${u.status}`
      .toLowerCase()
      .includes(q);
  });
}

function selectedUser(): ManagedUser | null {
  return users.find((u) => u.id === selectedUserId) ?? filteredUsers()[0] ?? null;
}

function logAction(action: string, target: string, reason: string): void {
  if (!session) return;
  auditLog.unshift({
    id: `A-${Date.now()}`,
    admin: session.email,
    action,
    target,
    reason,
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    ip: 'session',
  });
}

function chart(values: number[]): string {
  const max = Math.max(...values, 1);
  return `<div class="admin-chart">${values
    .map((v) => `<i style="height:${Math.max(8, (v / max) * 100)}%"></i>`)
    .join('')}</div>`;
}

function renderOverview(): string {
  const cards = [
    ['Total Users', STATS.totalUsers, 'Platform accounts'],
    ['Online Users', STATS.onlineUsers, 'Live presence'],
    ['New Registrations', STATS.newRegistrations, 'Last 24h'],
    ['Daily Active Users', STATS.dau, 'Trailing day'],
    ['Banned Users', STATS.bannedUsers, 'Active sanctions'],
    ['Moderators', STATS.moderators, 'Staff with chat tools'],
    ['Total Matches', STATS.totalMatches, 'Lifetime-to-date'],
    ['Transactions', STATS.totalTransactions, 'Shop + currency'],
    ['Server Status', STATS.serverStatus, 'Cluster health'],
    ['Open Reports', STATS.reports, 'Needs review'],
    ['Warnings', STATS.warnings, 'Issued this month'],
    ['Support Tickets', STATS.supportTickets, 'Queue depth'],
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
        <h3>User Growth</h3>
        ${chart(GROWTH)}
      </section>
      <section class="admin-panel">
        <h3>Recent Administrative Activity</h3>
        <ul class="admin-activity">
          ${auditLog
            .slice(0, 6)
            .map(
              (a) => `
            <li>
              <span><strong>${escapeHtml(a.action)}</strong> → ${escapeHtml(a.target)}<br/><small style="color:#9b93b5">${escapeHtml(a.reason)}</small></span>
              <span class="meta">${escapeHtml(a.at)}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </section>
    </div>
  `;
}

function renderUsers(): string {
  const list = filteredUsers();
  const u = selectedUser();
  return `
    <div class="admin-toolbar">
      <div class="admin-search">
        <input id="user-search" type="search" placeholder="Search ID, username, email, clan…" value="${escapeHtml(userQuery)}" />
      </div>
      ${(['all', 'online', 'offline', 'banned', 'muted', 'premium', 'moderator', 'recent'] as const)
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
            <th>ID</th><th>User</th><th>Email</th><th>Status</th><th>Role</th>
            <th>Clan</th><th>Matches</th><th>Balance</th><th>Reports</th><th>Last Login</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (row) => `
            <tr data-user="${row.id}" class="${row.id === u?.id ? 'active' : ''}">
              <td>${escapeHtml(row.id)}</td>
              <td><strong>${escapeHtml(row.displayName)}</strong><br/><small style="color:#9b93b5">@${escapeHtml(row.username)}</small></td>
              <td>${escapeHtml(row.email)}</td>
              <td><span class="badge ${row.status}">${row.status}</span></td>
              <td>${escapeHtml(row.role)}</td>
              <td>${escapeHtml(row.clan)}</td>
              <td>${fmt(row.matches)}</td>
              <td>${fmt(row.balance)}</td>
              <td>${row.reports}</td>
              <td>${escapeHtml(row.lastLogin)}</td>
            </tr>`,
            )
            .join('')}
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
            <dt>Status</dt><dd><span class="badge ${u.status}">${u.status}</span></dd>
            <dt>Registered</dt><dd>${escapeHtml(u.registered)}</dd>
            <dt>Last Login</dt><dd>${escapeHtml(u.lastLogin)}</dd>
            <dt>IP</dt><dd>${escapeHtml(u.ip)}</dd>
            <dt>Level</dt><dd>${u.level}</dd>
            <dt>Devices</dt><dd>Desktop · Chrome · Windows</dd>
            <dt>Sessions</dt><dd>2 active · 11 historical</dd>
          </dl>
          <label style="display:block;margin-top:14px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#9b93b5">ADMINISTRATIVE NOTES</label>
          <textarea class="admin-notes" id="admin-note" placeholder="Internal notes (not visible to players)…"></textarea>
        </section>
        <section class="admin-panel">
          <h3>Admin Actions</h3>
          <div class="admin-actions">
            <button type="button" data-act="edit">Edit Profile</button>
            <button type="button" data-act="reset-pw">Force Password Reset</button>
            <button type="button" data-act="reset-2fa">Reset 2FA</button>
            <button type="button" data-act="mute">Mute Chat</button>
            <button type="button" data-act="suspend">Suspend</button>
            <button type="button" data-act="ban" class="danger">Ban Account</button>
            <button type="button" data-act="unban">Restore Account</button>
            <button type="button" data-act="grant-currency">Grant Currency</button>
            <button type="button" data-act="grant-xp">Grant XP</button>
            <button type="button" data-act="grant-premium">Grant Premium</button>
            <button type="button" data-act="grant-item">Grant Item</button>
            <button type="button" data-act="warn">Issue Warning</button>
          </div>
          <h3 style="margin-top:20px">Timeline</h3>
          <ul class="admin-activity">
            <li><span>Login from ${escapeHtml(u.ip)}</span><span class="meta">${escapeHtml(u.lastLogin)}</span></li>
            <li><span>Completed ranked match</span><span class="meta">Yesterday</span></li>
            <li><span>Purchase · Neon Bundle</span><span class="meta">3d ago</span></li>
            <li><span>Joined clan ${escapeHtml(u.clan)}</span><span class="meta">${escapeHtml(u.registered)}</span></li>
          </ul>
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
          ${reports
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
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAnnouncements(): string {
  return `
    <section class="admin-panel">
      <h3>Create Announcement</h3>
      <div class="admin-field"><label>Title</label><input id="ann-title" placeholder="Neon Storm weekend rewards" /></div>
      <div class="admin-field"><label>Audience</label>
        <input id="ann-audience" list="ann-aud-list" placeholder="Everyone" />
        <datalist id="ann-aud-list">
          <option value="Everyone"/><option value="Premium users"/><option value="Moderators"/><option value="Administrators"/><option value="Specific groups"/>
        </datalist>
      </div>
      <label style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#9b93b5">BODY</label>
      <textarea class="admin-notes" id="ann-body" placeholder="Announcement content…"></textarea>
      <div class="admin-actions">
        <button type="button" id="ann-send">Publish Announcement</button>
      </div>
    </section>
  `;
}

function renderAnalytics(): string {
  return `
    <div class="admin-grid-2">
      <section class="admin-panel"><h3>User Growth</h3>${chart(GROWTH)}</section>
      <section class="admin-panel"><h3>Daily Active Users (k)</h3>${chart(DAU_SERIES)}</section>
    </div>
    <div class="admin-stats">
      <article class="admin-stat"><div class="label">Retention D7</div><div class="value">41%</div><div class="hint">Week-over-week</div></article>
      <article class="admin-stat"><div class="label">Revenue (30d)</div><div class="value">$84.2k</div><div class="hint">Shop + battle pass</div></article>
      <article class="admin-stat"><div class="label">Chat Messages</div><div class="value">1.2M</div><div class="hint">Last 30 days</div></article>
      <article class="admin-stat"><div class="label">Report Rate</div><div class="value">0.18%</div><div class="hint">Per active user</div></article>
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
          ${auditLog
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
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings(): string {
  const toggles = [
    ['maintenance', 'Maintenance Mode', 'Block matchmaking & show banner'],
    ['registration', 'Open Registration', 'Allow new account creation'],
    ['events', 'Events Enabled', 'Neon Storm and limited-time modes'],
    ['shop', 'Shop Enabled', 'Purchases and currency sinks'],
    ['notifications', 'Push Notifications', 'Desktop / email fanout'],
  ];
  return `
    <div class="admin-settings">
      ${toggles
        .map(
          ([id, title, desc], i) => `
        <div class="admin-toggle">
          <div><strong>${title}</strong><span>${desc}</span></div>
          <button type="button" class="admin-switch${i === 0 ? '' : ' on'}" data-toggle="${id}" aria-label="${title}"><i></i></button>
        </div>`,
        )
        .join('')}
    </div>
    <section class="admin-panel" style="margin-top:14px">
      <h3>Server Configuration</h3>
      <dl class="admin-kv">
        <dt>Region</dt><dd>Global Anycast</dd>
        <dt>Match Tick</dt><dd>60 Hz</dd>
        <dt>Chat Rate Limit</dt><dd>8 msg / 10s</dd>
        <dt>Attachment Max</dt><dd>25 MB</dd>
        <dt>Seed Email</dt><dd>${escapeHtml(getSeedEmail())}</dd>
      </dl>
    </section>
  `;
}

function pageTitle(): { title: string; sub: string } {
  const map: Record<Page, { title: string; sub: string }> = {
    overview: { title: 'Operations Overview', sub: 'Platform health at a glance' },
    users: { title: 'User Management', sub: 'Search, filter, and moderate accounts' },
    roles: { title: 'Roles & Permissions', sub: 'RBAC configuration' },
    reports: { title: 'Report Queue', sub: 'Review and resolve player reports' },
    announcements: { title: 'Announcements', sub: 'Broadcast to audiences' },
    analytics: { title: 'Analytics', sub: 'Growth, retention, and economy' },
    audit: { title: 'Audit Log', sub: 'Immutable administrative history' },
    files: { title: 'File Manager', sub: 'Upload files and share instant-download URLs' },
    settings: { title: 'System Settings', sub: 'Maintenance, features, server config' },
  };
  return map[page];
}

function renderBody(): string {
  if (!can(page)) return `<section class="admin-panel"><h3>Access denied</h3><p style="color:#9b93b5">Missing permission for this module.</p></section>`;
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
      render();
    });
  });
  root.querySelector('#admin-logout')?.addEventListener('click', () => {
    void serverAdminLogout();
    clearSession();
    session = null;
    render();
  });

  const search = root.querySelector<HTMLInputElement>('#user-search');
  search?.addEventListener('input', () => {
    userQuery = search.value;
    const pageEl = root.querySelector('#admin-page');
    if (pageEl) pageEl.innerHTML = renderUsers();
    bindUserPage();
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
      const pageEl = root.querySelector('#admin-page');
      if (pageEl) pageEl.innerHTML = renderUsers();
      bindUserPage();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = selectedUser();
      if (!u || !hasPermission(session, 'manage_users')) {
        toast('Missing manage_users permission');
        return;
      }
      const act = btn.dataset.act!;
      const reason = prompt('Reason / note for audit log', act.replace(/-/g, ' ')) || act;
      if (act === 'ban') u.status = 'banned';
      if (act === 'mute') u.status = 'muted';
      if (act === 'suspend') u.status = 'suspended';
      if (act === 'unban') u.status = 'offline';
      if (act === 'grant-premium') {
        u.status = 'premium';
        u.role = 'premium';
      }
      if (act === 'grant-currency') u.balance += 500;
      if (act === 'grant-xp') u.level += 1;
      logAction(act.toUpperCase().replace(/-/g, '_'), u.username, reason);
      toast(`Action ${act} applied to @${u.username}`);
      const pageEl = root.querySelector('#admin-page');
      if (pageEl) pageEl.innerHTML = renderUsers();
      bindUserPage();
    });
  });
}

function bindReports(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-report]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!hasPermission(session, 'manage_reports')) return;
      const id = btn.dataset.report!;
      const ract = btn.dataset.ract!;
      const r = reports.find((x) => x.id === id);
      if (!r) return;
      r.status = ract === 'resolve' ? 'resolved' : 'rejected';
      r.note = ract;
      logAction(ract === 'resolve' ? 'RESOLVE_REPORT' : 'REJECT_REPORT', id, r.category);
      toast(`Report ${id} marked ${r.status}`);
      const pageEl = root.querySelector('#admin-page');
      if (pageEl) pageEl.innerHTML = renderReports();
      bindReports();
    });
  });
}

function bindAnnouncements(): void {
  root.querySelector('#ann-send')?.addEventListener('click', () => {
    if (!hasPermission(session, 'manage_announcements')) return;
    const title = (root.querySelector<HTMLInputElement>('#ann-title')?.value || '').trim();
    const audience = (root.querySelector<HTMLInputElement>('#ann-audience')?.value || 'Everyone').trim();
    if (!title) {
      toast('Title required');
      return;
    }
    logAction('PUBLISH_ANNOUNCEMENT', audience, title);
    toast(`Announcement queued for ${audience}`);
  });
}

function bindSettings(): void {
  root.querySelectorAll<HTMLButtonElement>('.admin-switch').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!hasPermission(session, 'manage_settings')) return;
      btn.classList.toggle('on');
      const id = btn.dataset.toggle || 'setting';
      logAction('UPDATE_SETTING', id, btn.classList.contains('on') ? 'enabled' : 'disabled');
      toast(`Setting ${id} updated`);
    });
  });
}

function render(): void {
  session = getSession();
  if (!session) {
    renderLogin();
    return;
  }
  touchSession();
  renderShell();
}

// Idle logout
window.setInterval(() => {
  if (!getSession() && session) {
    session = null;
    toast('Session expired due to inactivity');
    render();
  } else if (getSession()) {
    // keep soft touch only on interaction
  }
}, 60_000);

document.addEventListener('click', () => {
  if (getSession()) touchSession();
});
document.addEventListener('keydown', () => {
  if (getSession()) touchSession();
});

// Obscure tab title slightly
document.title = 'Secure Console';

render();

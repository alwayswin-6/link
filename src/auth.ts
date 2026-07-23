const TOKEN_KEY = 'link-auth-token';
const API = '/api/auth';
const DEFAULT_AVATAR = '/position/defult.png';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  provider?: string | null;
  verified: boolean;
  rank?: number;
  rating?: number;
  country?: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
  createdAt: string;
}

type AuthMode = 'login' | 'signup';

let currentUser: AuthUser | null = null;
let onAuthChange: ((user: AuthUser | null) => void) | null = null;
let avatarCacheBust = '';

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value: string | null): void {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

function resolveAvatarSrc(user: AuthUser | null): string {
  const raw = user?.avatarUrl?.trim();
  if (!raw) return DEFAULT_AVATAR;
  if (raw.startsWith('/api/avatars/')) {
    const bust = avatarCacheBust || user?.createdAt || user?.id || '';
    return bust ? `${raw}?v=${encodeURIComponent(bust)}` : raw;
  }
  return raw;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${API}${path}`, { ...init, headers, signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok) {
      const err = new Error((data as { error?: string }).error || 'Request failed');
      (err as Error & { status: number; payload: unknown }).status = res.status;
      (err as Error & { status: number; payload: unknown }).payload = data;
      throw err;
    }
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The server took too long. Please try again.');
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

export function getUserAvatarSrc(user: AuthUser | null = currentUser): string {
  return resolveAvatarSrc(user);
}

export function getAuthUser(): AuthUser | null {
  return currentUser;
}

export function getAuthToken(): string | null {
  return token();
}

export function requireAuth(openIfGuest = true): boolean {
  if (currentUser) return true;
  if (openIfGuest) openAuthModal('signup');
  return false;
}

export async function refreshSession(): Promise<AuthUser | null> {
  if (!token()) {
    currentUser = null;
    onAuthChange?.(null);
    return null;
  }
  try {
    const data = await api<{ ok: boolean; user: AuthUser }>('/me');
    currentUser = data.user;
    onAuthChange?.(currentUser);
    return currentUser;
  } catch {
    setToken(null);
    currentUser = null;
    onAuthChange?.(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api('/logout', { method: 'POST', body: '{}' });
  } catch {
    /* ignore */
  }
  setToken(null);
  currentUser = null;
  avatarCacheBust = '';
  onAuthChange?.(null);
}

function modalHtml(): string {
  return `
  <div class="auth-overlay" id="auth-overlay" hidden>
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button type="button" class="auth-close" id="auth-close" aria-label="Close">×</button>
      <div class="auth-brand"><img class="auth-brand-logo" src="/position/logo.png" alt="" /><span>LINK</span></div>
      <h2 id="auth-title">Sign in</h2>
      <p class="auth-sub" id="auth-sub">Enter your account to play and save progress.</p>

      <div class="auth-page" id="auth-page-login">
        <form class="auth-form" id="auth-login-form" autocomplete="on">
          <label class="auth-field">
            <span>Email</span>
            <input type="email" name="email" id="auth-login-email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Password</span>
            <input type="password" name="password" id="auth-login-password" required minlength="8" autocomplete="current-password" />
          </label>
          <div class="auth-error" id="auth-login-error" hidden></div>
          <button type="submit" class="auth-submit">SIGN IN</button>
        </form>
        <div class="auth-switch">
          <button type="button" class="auth-link" id="auth-goto-signup">Create an account</button>
        </div>
      </div>

      <div class="auth-page" id="auth-page-signup" hidden>
        <div class="auth-providers">
          <a class="auth-provider" id="auth-oauth-gmail" href="/api/auth/oauth/google">
            <span class="auth-provider-icon gmail" aria-hidden="true">G</span>
            Sign up with Gmail
          </a>
          <a class="auth-provider" id="auth-oauth-outlook" href="/api/auth/oauth/outlook">
            <span class="auth-provider-icon outlook" aria-hidden="true">O</span>
            Sign up with Outlook
          </a>
        </div>
        <div class="auth-divider"><span>or sign up with email</span></div>
        <form class="auth-form" id="auth-signup-form" autocomplete="on">
          <label class="auth-field">
            <span>Name</span>
            <input type="text" name="name" id="auth-signup-name" required maxlength="24" autocomplete="name" />
          </label>
          <label class="auth-field">
            <span>Email</span>
            <input type="email" name="email" id="auth-signup-email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Password</span>
            <input type="password" name="password" id="auth-signup-password" required minlength="8" autocomplete="new-password" />
          </label>
          <div class="auth-error" id="auth-signup-error" hidden></div>
          <button type="submit" class="auth-submit" id="auth-signup-submit">SIGN UP</button>
        </form>
        <div class="auth-switch">
          <button type="button" class="auth-link" id="auth-goto-login">Already have an account? Sign in</button>
        </div>
      </div>
    </div>
  </div>`;
}

function showPage(next: AuthMode): void {
  const title = document.querySelector<HTMLHeadingElement>('#auth-title')!;
  const sub = document.querySelector<HTMLParagraphElement>('#auth-sub')!;
  document.querySelector('#auth-page-login')!.toggleAttribute('hidden', next !== 'login');
  document.querySelector('#auth-page-signup')!.toggleAttribute('hidden', next !== 'signup');

  if (next === 'login') {
    title.textContent = 'Sign in';
    sub.textContent = 'Enter your account to play and save progress.';
  } else {
    title.textContent = 'Create account';
    sub.textContent = 'Continue with Gmail or Outlook, or register with email.';
  }
}

function setMsg(id: string, msg: string, kind: 'error' | 'success'): void {
  const el = document.querySelector<HTMLDivElement>(`#${id}`)!;
  el.hidden = !msg;
  el.textContent = msg;
  el.className = kind === 'error' ? 'auth-error' : 'auth-success';
}

export function openAuthModal(next: AuthMode = 'login'): void {
  showPage(next);
  document.querySelector<HTMLDivElement>('#auth-overlay')!.hidden = false;
  if (next === 'signup') document.querySelector<HTMLInputElement>('#auth-signup-name')?.focus();
  else document.querySelector<HTMLInputElement>('#auth-login-email')?.focus();
}

export function closeAuthModal(): void {
  document.querySelector<HTMLDivElement>('#auth-overlay')!.hidden = true;
}

function updateChrome(user: AuthUser | null): void {
  const profileName = document.querySelector<HTMLElement>('.dash-profile-name');
  const userName = document.querySelector<HTMLElement>('.dash-user-name');
  const profileRank = document.querySelector<HTMLElement>('.dash-profile-rank');
  const profileCard = document.querySelector<HTMLElement>('#dash-profile-card');
  const guestBar = document.querySelector<HTMLElement>('#auth-guest-actions');
  const userChip = document.querySelector<HTMLButtonElement>('#auth-user-chip');
  const avatarImg = document.querySelector<HTMLImageElement>('.dash-user-avatar img');

  if (profileName) profileName.textContent = user ? user.username.toUpperCase() : 'GUEST';
  if (userName) userName.textContent = user ? user.username.toUpperCase() : 'PLAYER';
  if (profileRank) {
    const rankText = user ? `RANK #${user.rank ?? 1}` : 'UNRANKED';
    const iconNode = profileRank.querySelector('svg');
    profileRank.textContent = '';
    if (iconNode) profileRank.appendChild(iconNode);
    profileRank.append(` ${rankText}`);
  }

  if (avatarImg) {
    const next = resolveAvatarSrc(user);
    if (avatarImg.getAttribute('src') !== next) avatarImg.src = next;
    avatarImg.alt = user ? `${user.username} avatar` : 'Player avatar';
    avatarImg.onerror = () => {
      if (avatarImg.src.includes('defult.png')) return;
      avatarImg.onerror = null;
      avatarImg.src = DEFAULT_AVATAR;
    };
  }

  if (profileCard) profileCard.hidden = !user;

  if (guestBar) guestBar.hidden = !!user;
  if (userChip) {
    userChip.hidden = !user;
    userChip.dataset.authed = user ? '1' : '0';
    userChip.title = user ? user.email : '';
  }

  let adminBadge = document.querySelector<HTMLButtonElement>('#auth-admin-badge');
  if (user?.role === 'admin') {
    if (!adminBadge) {
      const right = document.querySelector('.dash-topbar-right');
      adminBadge = document.createElement('button');
      adminBadge.type = 'button';
      adminBadge.id = 'auth-admin-badge';
      adminBadge.className = 'dash-admin-badge';
      adminBadge.title = 'Open moderation panel';
      adminBadge.textContent = 'ADMIN';
      right?.insertBefore(adminBadge, userChip || null);
      adminBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        openModPanel();
      });
    }
    adminBadge.hidden = false;
  } else if (adminBadge) {
    adminBadge.hidden = true;
  }

  const menu = document.querySelector<HTMLElement>('#auth-user-menu');
  if (menu) menu.hidden = true;
  userChip?.classList.remove('open');
}

async function modApi<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  if (!t) throw new Error('Not signed in');
  const res = await fetch(`/api/mod${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${t}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
  return data;
}

function openModPanel(): void {
  if (currentUser?.role !== 'admin') {
    showToast('ADMIN access required');
    return;
  }
  let overlay = document.querySelector<HTMLDivElement>('#mod-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mod-overlay';
    overlay.className = 'mod-overlay';
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="mod-card" role="dialog" aria-label="Moderation panel">
      <div class="mod-head">
        <h3>ADMIN · Moderation</h3>
        <button type="button" class="mod-close" id="mod-close" aria-label="Close">×</button>
      </div>
      <p class="mod-note">Ban or suspend players. You cannot moderate other ADMINs. Full admin console is SUPER ADMIN only.</p>
      <input type="search" id="mod-search" class="mod-search" placeholder="Search players…" />
      <div class="mod-list" id="mod-list"><div class="mod-empty">Loading…</div></div>
    </div>`;

  const close = () => {
    overlay!.hidden = true;
  };
  overlay.querySelector('#mod-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const listEl = overlay.querySelector('#mod-list')!;
  const searchEl = overlay.querySelector<HTMLInputElement>('#mod-search')!;

  const renderList = async (q = '') => {
    try {
      const data = await modApi<{
        ok: true;
        users: { id: string; username: string; email: string; status: string; role: string }[];
      }>(`/users?q=${encodeURIComponent(q)}`);
      if (!data.users.length) {
        listEl.innerHTML = `<div class="mod-empty">No players found</div>`;
        return;
      }
      listEl.innerHTML = data.users
        .map((u) => {
          const isAdmin = u.role === 'admin';
          return `<div class="mod-row" data-id="${u.id}">
            <div>
              <strong>${escapeMod(u.username)}</strong>
              ${isAdmin ? '<span class="mod-tag">ADMIN</span>' : ''}
              <small>${escapeMod(u.status)}</small>
            </div>
            <div class="mod-acts">
              ${
                isAdmin || u.id === currentUser?.id
                  ? '<span class="mod-locked">Locked</span>'
                  : `<button type="button" data-status="muted">Mute</button>
                     <button type="button" data-status="suspended">Suspend</button>
                     <button type="button" data-status="banned" class="danger">Ban</button>
                     <button type="button" data-status="active">Restore</button>`
              }
            </div>
          </div>`;
        })
        .join('');
    } catch (err) {
      listEl.innerHTML = `<div class="mod-empty">${escapeMod(err instanceof Error ? err.message : 'Failed')}</div>`;
    }
  };

  listEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-status]');
    const row = (e.target as HTMLElement).closest<HTMLElement>('.mod-row');
    if (!btn || !row?.dataset.id) return;
    const status = btn.dataset.status!;
    void (async () => {
      try {
        await modApi(`/users/${encodeURIComponent(row.dataset.id!)}/status`, {
          method: 'POST',
          body: JSON.stringify({ status, reason: `mod:${status}` }),
        });
        showToast(`User ${status}`);
        await renderList(searchEl.value.trim());
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed');
      }
    })();
  });

  let timer = 0;
  searchEl.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void renderList(searchEl.value.trim()), 200);
  });
  void renderList();
}

function escapeMod(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupUserMenu(): void {
  const chip = document.querySelector<HTMLButtonElement>('#auth-user-chip');
  if (!chip || chip.dataset.menuReady === '1') return;
  chip.dataset.menuReady = '1';

  const wrap = document.createElement('div');
  wrap.className = 'auth-user-wrap';
  chip.parentElement?.insertBefore(wrap, chip);
  wrap.appendChild(chip);

  const menu = document.createElement('div');
  menu.className = 'auth-user-menu';
  menu.id = 'auth-user-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" class="auth-user-menu-item" data-act="profile">User Profile</button>
    <button type="button" class="auth-user-menu-item" data-act="avatar">Change avatar</button>
    <button type="button" class="auth-user-menu-item" data-act="logout">Log Out</button>
  `;
  wrap.appendChild(menu);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.hidden = true;
  fileInput.id = 'auth-avatar-input';
  wrap.appendChild(fileInput);

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUser) return;
    menu.hidden = !menu.hidden;
    chip.classList.toggle('open', !menu.hidden);
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    await uploadAvatar(file);
  });

  menu.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')?.dataset.act;
    if (!act) return;
    menu.hidden = true;
    chip.classList.remove('open');
    if (act === 'profile') {
      document.dispatchEvent(new CustomEvent('link:open-profile'));
    } else if (act === 'avatar') {
      fileInput.click();
    } else if (act === 'logout') {
      await logout();
      showToast('Signed out');
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !wrap.contains(e.target as Node)) {
      menu.hidden = true;
      chip.classList.remove('open');
    }
  });
}

async function uploadAvatar(file: File): Promise<void> {
  const t = token();
  if (!t) {
    openAuthModal('signup');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be 5MB or smaller');
    return;
  }

  const body = new FormData();
  body.append('avatar', file);

  try {
    const res = await fetch(`${API}/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      user?: AuthUser;
    };
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Upload failed');
    }
    avatarCacheBust = String(Date.now());
    currentUser = data.user;
    onAuthChange?.(currentUser);
    showToast('Avatar updated');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not update avatar');
  }
}

function consumeOAuthReturn(): void {
  const params = new URLSearchParams(window.location.search);
  const authToken = params.get('authToken');
  const authError = params.get('authError');
  if (authToken) {
    setToken(authToken);
    params.delete('authToken');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  } else if (authError) {
    openAuthModal('signup');
    setMsg('auth-signup-error', `Provider sign-up failed (${authError}). Try email sign-up instead.`, 'error');
    params.delete('authError');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }
}

export async function initAuth(onChange?: (user: AuthUser | null) => void): Promise<void> {
  onAuthChange = (user) => {
    updateChrome(user);
    document.dispatchEvent(new CustomEvent('link:auth-changed', { detail: user }));
    onChange?.(user);
  };

  const host = document.querySelector('#dashboard') ?? document.body;
  host.insertAdjacentHTML('beforeend', modalHtml());

  const topRight = document.querySelector('.dash-topbar-right');
  if (topRight && !document.querySelector('#auth-guest-actions')) {
    const guest = document.createElement('div');
    guest.id = 'auth-guest-actions';
    guest.className = 'auth-guest-actions';
    guest.innerHTML = `
      <button type="button" class="auth-top-btn" id="auth-open-signup">SIGN UP</button>
    `;
    const chip = topRight.querySelector('#auth-user-chip') ?? topRight.querySelector('.dash-user-chip');
    if (chip) {
      chip.id = 'auth-user-chip';
      (chip as HTMLElement).hidden = true;
      topRight.insertBefore(guest, chip);
    } else {
      topRight.appendChild(guest);
    }
  }

  document.querySelector('#auth-open-signup')?.addEventListener('click', () => openAuthModal('signup'));
  document.querySelector('#auth-close')?.addEventListener('click', closeAuthModal);
  document.querySelector('#auth-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'auth-overlay') closeAuthModal();
  });
  document.querySelector('#auth-goto-signup')?.addEventListener('click', () => openAuthModal('signup'));
  document.querySelector('#auth-goto-login')?.addEventListener('click', () => openAuthModal('login'));

  document.querySelector('#auth-oauth-gmail')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/api/auth/oauth/google';
  });
  document.querySelector('#auth-oauth-outlook')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/api/auth/oauth/outlook';
  });

  setupUserMenu();

  document.querySelector('#auth-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector<HTMLInputElement>('#auth-login-email')!.value.trim();
    const password = document.querySelector<HTMLInputElement>('#auth-login-password')!.value;
    const btn = (e.target as HTMLFormElement).querySelector<HTMLButtonElement>('.auth-submit')!;
    btn.disabled = true;
    setMsg('auth-login-error', '', 'error');
    try {
      const data = await api<{ token: string; user: AuthUser }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      currentUser = data.user;
      onAuthChange?.(currentUser);
      closeAuthModal();
      showToast(`Welcome, ${data.user.username}`);
    } catch (err) {
      setMsg('auth-login-error', err instanceof Error ? err.message : 'Sign in failed.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelector('#auth-signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.querySelector<HTMLInputElement>('#auth-signup-name')!.value.trim();
    const email = document.querySelector<HTMLInputElement>('#auth-signup-email')!.value.trim();
    const password = document.querySelector<HTMLInputElement>('#auth-signup-password')!.value;
    const btn = document.querySelector<HTMLButtonElement>('#auth-signup-submit')!;
    btn.disabled = true;
    btn.textContent = 'CREATING…';
    setMsg('auth-signup-error', '', 'error');

    try {
      const data = await api<{ token: string; user: AuthUser; message: string }>('/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setToken(data.token);
      currentUser = data.user;
      onAuthChange?.(currentUser);
      closeAuthModal();
      showToast(data.message || `Welcome, ${data.user.username}`);
    } catch (err) {
      setMsg('auth-signup-error', err instanceof Error ? err.message : 'Sign up failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'SIGN UP';
    }
  });

  consumeOAuthReturn();
  await refreshSession();
}

function showToast(msg: string): void {
  let el = document.querySelector<HTMLDivElement>('.auth-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'auth-toast';
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.textContent = msg;
  window.setTimeout(() => {
    el!.hidden = true;
  }, 2400);
}

const TOKEN_KEY = 'link-auth-token';
const API = '/api/auth';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  provider?: string | null;
  verified: boolean;
  rank?: number;
  rating?: number;
  country?: string;
  createdAt: string;
}

type AuthMode = 'login' | 'signup';

let currentUser: AuthUser | null = null;
let onAuthChange: ((user: AuthUser | null) => void) | null = null;

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value: string | null): void {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
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
  onAuthChange?.(null);
}

function modalHtml(): string {
  return `
  <div class="auth-overlay" id="auth-overlay" hidden>
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button type="button" class="auth-close" id="auth-close" aria-label="Close">×</button>
      <div class="auth-brand">LINK</div>
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

  if (profileName) profileName.textContent = user ? user.username.toUpperCase() : 'GUEST';
  if (userName) userName.textContent = user ? user.username.toUpperCase() : 'PLAYER';
  if (profileRank) {
    const rankText = user ? `RANK #${user.rank ?? 1}` : 'UNRANKED';
    const iconNode = profileRank.querySelector('svg');
    profileRank.textContent = '';
    if (iconNode) profileRank.appendChild(iconNode);
    profileRank.append(` ${rankText}`);
  }

  if (profileCard) profileCard.hidden = !user;

  if (guestBar) guestBar.hidden = !!user;
  if (userChip) {
    userChip.hidden = !user;
    userChip.dataset.authed = user ? '1' : '0';
    userChip.title = user ? user.email : '';
  }
  const menu = document.querySelector<HTMLElement>('#auth-user-menu');
  if (menu) menu.hidden = true;
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
    <button type="button" class="auth-user-menu-item" data-act="logout">Log Out</button>
  `;
  wrap.appendChild(menu);

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUser) return;
    menu.hidden = !menu.hidden;
    chip.classList.toggle('open', !menu.hidden);
  });

  menu.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]')?.dataset.act;
    if (!act) return;
    menu.hidden = true;
    chip.classList.remove('open');
    if (act === 'profile') {
      document.dispatchEvent(new CustomEvent('link:open-profile'));
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

function consumeOAuthReturn(): void {
  const params = new URLSearchParams(window.location.search);
  const authToken = params.get('authToken');
  const authError = params.get('authError');
  if (authToken) {
    setToken(authToken);
    params.delete('authToken');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  } else if (authError) {
    openAuthModal('signup');
    setMsg('auth-signup-error', `Provider sign-up failed (${authError}). Try email sign-up instead.`, 'error');
    params.delete('authError');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }
}

export async function initAuth(onChange?: (user: AuthUser | null) => void): Promise<void> {
  onAuthChange = (user) => {
    updateChrome(user);
    onChange?.(user);
  };

  document.body.insertAdjacentHTML('beforeend', modalHtml());

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

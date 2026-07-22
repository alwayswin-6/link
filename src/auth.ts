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
  createdAt: string;
}

type AuthMode = 'login' | 'signup' | 'verify';

let currentUser: AuthUser | null = null;
let pendingId: string | null = null;
let pendingEmail = '';
let inboxUrl: string | null = null;
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

      <!-- LOGIN PAGE -->
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

      <!-- SIGNUP PAGE (no verification field) -->
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
          <label class="auth-field">
            <span>Country</span>
            <select name="country" id="auth-signup-country" required>
              <option value="">Select country</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Spain">Spain</option>
              <option value="Italy">Italy</option>
              <option value="Brazil">Brazil</option>
              <option value="Mexico">Mexico</option>
              <option value="Japan">Japan</option>
              <option value="South Korea">South Korea</option>
              <option value="China">China</option>
              <option value="India">India</option>
              <option value="Australia">Australia</option>
              <option value="Russia">Russia</option>
              <option value="Turkey">Turkey</option>
              <option value="Poland">Poland</option>
              <option value="Netherlands">Netherlands</option>
              <option value="Sweden">Sweden</option>
              <option value="Philippines">Philippines</option>
              <option value="Indonesia">Indonesia</option>
              <option value="Vietnam">Vietnam</option>
              <option value="Thailand">Thailand</option>
              <option value="Singapore">Singapore</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="South Africa">South Africa</option>
              <option value="Argentina">Argentina</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <div class="auth-error" id="auth-signup-error" hidden></div>
          <button type="submit" class="auth-submit" id="auth-signup-submit">SIGN UP</button>
        </form>
        <div class="auth-switch">
          <button type="button" class="auth-link" id="auth-goto-login">Already have an account? Sign in</button>
        </div>
      </div>

      <!-- VERIFY PAGE (only after SIGN UP) -->
      <div class="auth-page" id="auth-page-verify" hidden>
        <form class="auth-form" id="auth-verify-form" autocomplete="one-time-code">
          <label class="auth-field">
            <span>6-digit verification code</span>
            <input type="text" name="otp" id="auth-otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code" />
          </label>
          <div class="auth-success" id="auth-verify-success" hidden></div>
          <div class="auth-error" id="auth-verify-error" hidden></div>
          <button type="submit" class="auth-submit">VERIFY &amp; CREATE ACCOUNT</button>
        </form>
        <div class="auth-switch">
          <a class="auth-link" id="auth-open-inbox" href="#" target="_blank" rel="noopener" hidden>Open inbox</a>
          <button type="button" class="auth-link" id="auth-resend">Resend code</button>
          <button type="button" class="auth-link" id="auth-back-signup">Back</button>
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
  document.querySelector('#auth-page-verify')!.toggleAttribute('hidden', next !== 'verify');

  if (next === 'login') {
    title.textContent = 'Sign in';
    sub.textContent = 'Enter your account to play and save progress.';
  } else if (next === 'signup') {
    title.textContent = 'Create account';
    sub.textContent = 'Continue with Gmail or Outlook, or register with email.';
    pendingId = null;
  } else {
    title.textContent = 'Verify your email';
    sub.textContent = `Enter the 6-digit code we sent to ${pendingEmail}.`;
  }
}

function setMsg(id: string, msg: string, kind: 'error' | 'success'): void {
  const el = document.querySelector<HTMLDivElement>(`#${id}`)!;
  el.hidden = !msg;
  el.textContent = msg;
  el.className = kind === 'error' ? 'auth-error' : 'auth-success';
}

export function openAuthModal(next: AuthMode = 'login'): void {
  showPage(next === 'verify' ? 'verify' : next);
  document.querySelector<HTMLDivElement>('#auth-overlay')!.hidden = false;
  if (next === 'signup') document.querySelector<HTMLInputElement>('#auth-signup-name')?.focus();
  else if (next === 'verify') document.querySelector<HTMLInputElement>('#auth-otp')?.focus();
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
    // Preserve the leading rank icon; only swap the label text.
    const rankText = user ? `RANK #${user.rank ?? 1}` : 'UNRANKED';
    const iconNode = profileRank.querySelector('svg');
    profileRank.textContent = '';
    if (iconNode) profileRank.appendChild(iconNode);
    profileRank.append(` ${rankText}`);
  }

  // Sidebar player card only appears once the user has signed in.
  if (profileCard) profileCard.hidden = !user;

  // Guest: only SIGN UP. Signed in: hide SIGN UP / SIGN IN, show avatar chip.
  if (guestBar) guestBar.hidden = !!user;
  if (userChip) {
    userChip.hidden = !user;
    userChip.dataset.authed = user ? '1' : '0';
    userChip.title = user ? user.email : '';
  }
  // Any open account menu should close on auth change.
  const menu = document.querySelector<HTMLElement>('#auth-user-menu');
  if (menu) menu.hidden = true;
}

/** Turns the avatar chip into a dropdown with "User Profile" and "Log Out". */
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

async function pollEmailStatus(id: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (pendingId !== id) return;
    try {
      const st = await api<{ emailStatus: string; emailError?: string; email: string }>(
        `/register/status/${id}`,
      );
      if (st.emailStatus === 'sent') {
        setMsg('auth-verify-success', `Code sent to ${st.email}. Check your inbox (and spam).`, 'success');
        setMsg('auth-verify-error', '', 'error');
        return;
      }
      if (st.emailStatus === 'failed') {
        setMsg('auth-verify-success', '', 'success');
        setMsg(
          'auth-verify-error',
          st.emailError || 'Could not send the email. Tap Resend code.',
          'error',
        );
        return;
      }
    } catch {
      /* keep polling */
    }
    await new Promise((r) => window.setTimeout(r, 1500));
  }
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
  document.querySelector('#auth-back-signup')?.addEventListener('click', () => openAuthModal('signup'));

  // Gmail / Outlook: full browser redirect into provider registration / OAuth
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
    const country = document.querySelector<HTMLSelectElement>('#auth-signup-country')!.value.trim();
    const btn = document.querySelector<HTMLButtonElement>('#auth-signup-submit')!;
    if (!country) {
      setMsg('auth-signup-error', 'Select your country.', 'error');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'SENDING CODE…';
    setMsg('auth-signup-error', '', 'error');

    try {
      const data = await api<{
        pendingId: string;
        email: string;
        message: string;
        inbox?: { url: string | null; provider: string };
      }>('/register/start', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, country }),
      });

      pendingId = data.pendingId;
      pendingEmail = data.email;
      inboxUrl = data.inbox?.url ?? null;

      // Verification page appears only after SIGN UP — never on the signup form
      showPage('verify');
      setMsg('auth-verify-success', data.message, 'success');
      setMsg('auth-verify-error', '', 'error');

      const inbox = document.querySelector<HTMLAnchorElement>('#auth-open-inbox')!;
      if (inboxUrl) {
        inbox.hidden = false;
        inbox.href = inboxUrl;
        inbox.textContent = /gmail/i.test(data.inbox?.provider || '') ? 'Open Gmail' : 'Open Outlook';
      } else {
        inbox.hidden = true;
      }
      document.querySelector<HTMLInputElement>('#auth-otp')!.value = '';
      document.querySelector<HTMLInputElement>('#auth-otp')?.focus();
      void pollEmailStatus(data.pendingId);
    } catch (err) {
      setMsg('auth-signup-error', err instanceof Error ? err.message : 'Sign up failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'SIGN UP';
    }
  });

  document.querySelector('#auth-verify-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.querySelector<HTMLInputElement>('#auth-otp')!.value.trim();
    const btn = (e.target as HTMLFormElement).querySelector<HTMLButtonElement>('.auth-submit')!;
    btn.disabled = true;
    setMsg('auth-verify-error', '', 'error');
    try {
      if (!pendingId) throw new Error('Verification expired. Start sign-up again.');
      const data = await api<{ token: string; user: AuthUser; message: string }>('/register/confirm', {
        method: 'POST',
        body: JSON.stringify({ pendingId, code }),
      });
      setToken(data.token);
      currentUser = data.user;
      pendingId = null;
      onAuthChange?.(currentUser);
      closeAuthModal();
      showToast(data.message || `Welcome, ${data.user.username}`);
    } catch (err) {
      setMsg('auth-verify-error', err instanceof Error ? err.message : 'Verification failed.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelector('#auth-resend')?.addEventListener('click', async () => {
    if (!pendingId) {
      setMsg('auth-verify-error', 'Verification expired. Start sign-up again.', 'error');
      return;
    }
    try {
      const data = await api<{ message: string }>('/register/resend', {
        method: 'POST',
        body: JSON.stringify({ pendingId }),
      });
      setMsg('auth-verify-success', data.message, 'success');
      setMsg('auth-verify-error', '', 'error');
    } catch (err) {
      setMsg('auth-verify-error', err instanceof Error ? err.message : 'Could not resend code.', 'error');
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

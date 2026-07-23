import { getAuthUser, getUserAvatarSrc, openModPanel, uploadAvatar } from './auth';
import { showToast } from './ui';
import { openDiscordInvite } from './discord';

export interface PageDescriptor {
  id: string;
  title: string;
  subtitle?: string;
  html: string;
  onMount?: (root: HTMLElement) => void;
}

export interface RouterCallbacks {
  showGame: () => void;
  showChat: () => void;
  setActiveNav: (nav: string) => void;
  /** Open a top-level route by page id (used for deep links / back-forward). */
  openRoute: (id: string) => void;
  showHomeShell: () => void;
}

let cb: RouterCallbacks;
let mainEl: HTMLElement;
let homeEl: HTMLElement;
let pageEl: HTMLElement;
const stack: PageDescriptor[] = [];

/** Friendly public paths that differ from internal page ids. */
const PATH_BY_ID: Record<string, string> = {
  ranking: '/leaderboard',
  'how-to-play': '/how-to-play',
};

const ID_BY_PATH: Record<string, string> = {
  '/leaderboard': 'ranking',
  '/how-to-play': 'how-to-play',
  '/help': 'how-to-play',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function pathForPage(id: string): string {
  return PATH_BY_ID[id] ?? `/${id}`;
}

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p;
}

/** Map URL path → page id. `null` means home. `chat` is a special shell route. */
export function routeIdFromPath(pathname: string): string | null {
  const p = normalizePath(pathname);
  if (p === '/') return null;
  if (p.startsWith('/admin')) return null;
  if (p === '/chat') return 'chat';
  if (ID_BY_PATH[p]) return ID_BY_PATH[p];
  return p.slice(1) || null;
}

export function setPath(path: string, replace = false): void {
  const next = normalizePath(path);
  const current = normalizePath(location.pathname);
  if (current === next) {
    history.replaceState({ linkPath: next }, '', next);
    return;
  }
  if (replace) history.replaceState({ linkPath: next }, '', next);
  else history.pushState({ linkPath: next }, '', next);
}

function migrateLegacyHash(): void {
  const hash = location.hash;
  if (!hash.startsWith('#/')) return;
  const legacy = normalizePath(hash.slice(1) || '/');
  const mapped =
    legacy === '/leaderboard' || legacy === '/ranking'
      ? '/leaderboard'
      : legacy === '/help'
        ? '/how-to-play'
        : legacy;
  history.replaceState({ linkPath: mapped }, '', mapped);
}

export function initRouter(callbacks: RouterCallbacks): void {
  cb = callbacks;
  mainEl = document.querySelector<HTMLElement>('.dash-main')!;
  homeEl = document.querySelector<HTMLElement>('#dash-home')!;

  pageEl = document.createElement('div');
  pageEl.id = 'page-view';
  pageEl.className = 'dash-page';
  pageEl.hidden = true;
  mainEl.appendChild(pageEl);

  migrateLegacyHash();

  window.addEventListener('popstate', () => {
    applyLocation({ fromPop: true });
  });

  applyLocation({ replace: true });
}

function applyLocation(opts: { fromPop?: boolean; replace?: boolean } = {}): void {
  const id = routeIdFromPath(location.pathname);
  if (id === 'chat') {
    stack.length = 0;
    if (pageEl) {
      pageEl.hidden = true;
      pageEl.innerHTML = '';
    }
    cb.showChat();
    return;
  }
  if (!id) {
    stack.length = 0;
    cb.showHomeShell();
    renderHome();
    return;
  }
  // Restore from stack when possible (browser back within nested pages)
  if (opts.fromPop) {
    const idx = [...stack].map((p) => p.id).lastIndexOf(id);
    if (idx >= 0) {
      stack.length = idx + 1;
      renderPage(stack[idx]!);
      cb.setActiveNav(navForPageId(id));
      return;
    }
  }
  stack.length = 0;
  cb.openRoute(id);
}

function navForPageId(id: string): string {
  if (id === 'how-to-play') return 'help';
  if (id === 'player' || id === 'statistics') return 'ranking';
  if (id === 'article' || id === 'news' || id === 'event') return 'community';
  if (id.startsWith('fortune')) return 'fortune';
  return id;
}

function renderHome(): void {
  pageEl.hidden = true;
  pageEl.innerHTML = '';
  homeEl.hidden = false;
  document.querySelector('#dashboard')?.classList.remove('is-chat');
  mainEl.classList.remove('is-chat');
  cb.setActiveNav('home');
  window.scrollTo({ top: 0 });
  document.querySelector('#dashboard')?.scrollTo?.({ top: 0 });
}

function renderPage(page: PageDescriptor): void {
  // Leave chat/home, show the page container
  document.querySelector('#dashboard')?.classList.remove('is-chat');
  mainEl.classList.remove('is-chat');
  homeEl.hidden = true;
  pageEl.hidden = false;
  pageEl.dataset.page = page.id;
  pageEl.innerHTML = `
    <div class="page-head">
      <button type="button" class="page-back" id="page-back">${backIcon()} BACK</button>
      <div class="page-titles">
        <h1 class="page-title">${esc(page.title)}</h1>
        ${page.subtitle ? `<p class="page-sub">${esc(page.subtitle)}</p>` : ''}
      </div>
    </div>
    <div class="page-body" id="page-body">${page.html}</div>
  `;
  pageEl.querySelector('#page-back')?.addEventListener('click', () => goBack());
  const body = pageEl.querySelector<HTMLElement>('#page-body')!;
  page.onMount?.(body);
  const dash = document.querySelector<HTMLElement>('#dashboard');
  dash?.scrollTo?.({ top: 0 });
  window.scrollTo({ top: 0 });
}

export function openPage(page: PageDescriptor): void {
  stack.push(page);
  setPath(pathForPage(page.id));
  renderPage(page);
  cb.setActiveNav(navForPageId(page.id));
}

export function goHome(): void {
  stack.length = 0;
  setPath('/');
  cb.showHomeShell();
  renderHome();
}

/** Hide the page container without restoring the home scroll (used when opening chat/game). */
export function hidePageView(): void {
  if (!pageEl) return;
  stack.length = 0;
  pageEl.hidden = true;
  pageEl.innerHTML = '';
}

export function goBack(): void {
  if (stack.length <= 1) {
    goHome();
    return;
  }
  stack.pop();
  const top = stack[stack.length - 1]!;
  setPath(pathForPage(top.id));
  renderPage(top);
  cb.setActiveNav(navForPageId(top.id));
}

/* ————————————————————————————— Static pages ————————————————————————————— */

export function openProfile(): void {
  const user = getAuthUser();
  const name = (user?.username ?? 'Guest').toUpperCase();
  const rank = user?.rank ?? 1;
  const rating = user?.rating ?? 0;
  const avatar = getUserAvatarSrc(user);
  openPage({
    id: 'profile',
    title: 'PLAYER PROFILE',
    subtitle: user ? esc(user.email) : 'Guest session',
    html: `
      <div class="page-card page-profile">
        <div class="page-profile-top">
          <div class="page-avatar">
            <img id="profile-avatar-img" src="${esc(avatar)}" alt="" />
          </div>
          <div>
            <h2 class="page-profile-name">${esc(name)}</h2>
            <p class="page-badge">◆ RANK #${rank} · Season 1</p>
            ${
              user
                ? `<div class="page-avatar-actions">
              <button type="button" class="page-btn" id="profile-avatar-btn">Change avatar</button>
              <input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
            </div>`
                : ''
            }
          </div>
        </div>
        <div class="page-stat-grid">
          <div class="page-stat">Rank<strong>#${rank}</strong></div>
          <div class="page-stat">Rating<strong>${rating}</strong></div>
          <div class="page-stat">Matches<strong>0</strong></div>
          <div class="page-stat">Status<strong>${user ? 'Online' : 'Guest'}</strong></div>
        </div>
        <p class="page-text">${
          user
            ? 'Welcome to LINK! You start at Rank #1 — play ranked matches to climb the leaderboard.'
            : 'Sign up to save your progress, unlock ranked play, and join clans.'
        }</p>
      </div>
    `,
    onMount(root) {
      root.querySelector('#p-stats')?.addEventListener('click', () => openStatistics());
      const btn = root.querySelector<HTMLButtonElement>('#profile-avatar-btn');
      const input = root.querySelector<HTMLInputElement>('#profile-avatar-input');
      const img = root.querySelector<HTMLImageElement>('#profile-avatar-img');
      btn?.addEventListener('click', () => input?.click());
      input?.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        await uploadAvatar(file);
        const next = getUserAvatarSrc(getAuthUser());
        if (img) img.src = next;
      });
    },
  });
}

/** Player-ADMIN moderation page (opened from header ADMIN badge). */
export function openModerationPage(): void {
  const user = getAuthUser();
  if (!user || user.role !== 'admin') {
    showToast('ADMIN access required');
    return;
  }
  openPage({
    id: 'moderation',
    title: 'USER MANAGEMENT',
    subtitle: 'ADMIN tools · ban, suspend, and mute players',
    html: `
      <div class="page-card page-moderation">
        <p class="page-text">Manage regular players from here. You cannot moderate other ADMINs. The full SUPER ADMIN console is separate.</p>
        <button type="button" class="page-btn" id="mod-open-panel">Open management panel</button>
      </div>
    `,
    onMount(root) {
      root.querySelector('#mod-open-panel')?.addEventListener('click', () => openModPanel());
      openModPanel();
    },
  });
}

export function openStatistics(): void {
  openPage({
    id: 'statistics',
    title: 'STATISTICS',
    subtitle: 'Lifetime performance',
    html: `
      <div class="page-stat-grid wide">
        <div class="page-stat">Matches<strong>128</strong></div>
        <div class="page-stat">Wins<strong>74</strong></div>
        <div class="page-stat">Win rate<strong>58%</strong></div>
        <div class="page-stat">Best streak<strong>9</strong></div>
        <div class="page-stat">Nodes captured<strong>1,240</strong></div>
        <div class="page-stat">Zones formed<strong>86</strong></div>
        <div class="page-stat">Playtime<strong>47h</strong></div>
        <div class="page-stat">Rank rating<strong>2,180</strong></div>
      </div>
      <p class="page-text">Training games do not affect ranked rating. Stats refresh after each online match.</p>
    `,
  });
}

export function openMatches(): void {
  cb.setActiveNav('matches');
  const matches = [
    ['Victory', 'Ranked', 'ShadowLink vs NeonX', '+28 RP', '2h ago'],
    ['Defeat', 'Quick Match', 'PulseFire vs GridWalker', '—', '5h ago'],
    ['Victory', 'Ranked', 'CyberNull vs ApexNode', '+22 RP', 'Yesterday'],
    ['Victory', 'Custom', 'Lobby · 6 players', '—', 'Yesterday'],
    ['Defeat', 'Ranked', 'VoltArrow vs LinkMaster', '-16 RP', '2d ago'],
  ];
  openPage({
    id: 'matches',
    title: 'MATCH HISTORY',
    subtitle: 'Recent competitive activity',
    html: `
      <div class="page-table">
        <div class="page-tr head">
          <span>Result</span><span>Mode</span><span>Match</span><span>RP</span><span>When</span>
        </div>
        ${matches
          .map(
            ([result, mode, match, rp, when]) => `
          <div class="page-tr">
            <span class="${result === 'Victory' ? 'match-win' : 'match-loss'}">${result}</span>
            <span>${mode}</span>
            <span>${match}</span>
            <span>${rp}</span>
            <span>${when}</span>
          </div>`,
          )
          .join('')}
      </div>
    `,
  });
}

type InvItem = {
  name: string;
  type: string;
  rarity: string;
  desc: string;
  set: string;
  unlock: string;
  season: string;
  img: string;
};

const INV_ITEMS: InvItem[] = [
  {
    name: 'Neon Edge',
    type: 'Weapon Skin',
    rarity: 'Epic',
    desc: 'A charged blade finish that leaves neon trails on every swing.',
    set: 'Neon Circuit',
    unlock: 'Season shop',
    season: 'Season 01',
    img: '/position/game-general-1.png',
  },
  {
    name: 'Circuit Badge',
    type: 'Profile Badge',
    rarity: 'Rare',
    desc: 'Show your ranked grind with a circuit-etched profile mark.',
    set: 'Identity',
    unlock: 'Ranked reward',
    season: 'Season 01',
    img: '/position/game-general-2.png',
  },
  {
    name: 'Storm Trail',
    type: 'Finisher',
    rarity: 'Legendary',
    desc: 'End matches with a storm-link cascade across the arena.',
    set: 'Stormfront',
    unlock: 'Tournament drop',
    season: 'Season 01',
    img: '/position/game-general-3.png',
  },
  {
    name: 'Void Frame',
    type: 'Avatar Frame',
    rarity: 'Epic',
    desc: 'A dark frame edged with void-green energy.',
    set: 'Identity',
    unlock: 'Battle Pass',
    season: 'Season 01',
    img: '/position/game-general-4.png',
  },
  {
    name: 'Pulse Emote',
    type: 'Emote',
    rarity: 'Common',
    desc: 'A quick pulse salute for lobby and post-match moments.',
    set: 'Expressions',
    unlock: 'Default unlock',
    season: 'Season 01',
    img: '/position/image1.png',
  },
  {
    name: 'Season 1 Pass',
    type: 'Battle Pass',
    rarity: 'Premium',
    desc: 'Access the full Season 01 reward track and exclusive cosmetics.',
    set: 'Seasonal',
    unlock: 'Purchase / earn',
    season: 'Season 01',
    img: '/position/image2.png',
  },
];

function invRarityClass(rarity: string): string {
  return `inv-badge inv-badge--${rarity.toLowerCase()}`;
}

function renderInvCards(list: InvItem[], equipped: Set<string>, selected: string): string {
  return list
    .map((item, i) => {
      const eq = equipped.has(item.name);
      const sel = selected === item.name ? ' is-selected' : '';
      return `
        <article class="inv-item-card${sel}${eq ? ' is-equipped' : ''}" data-name="${esc(item.name)}" data-idx="${i}">
          <div class="inv-item-art">
            <img src="${esc(item.img)}" alt="" />
            <span class="${invRarityClass(item.rarity)}">${esc(item.rarity)}</span>
            ${eq ? '<span class="inv-equipped-tag">Equipped</span>' : ''}
          </div>
          <div class="inv-item-body">
            <h4 class="inv-item-name">${esc(item.name)}</h4>
            <p class="inv-item-type">${esc(item.type)}</p>
            <button type="button" class="inv-equip-btn${eq ? ' is-on' : ''}" data-equip="${esc(item.name)}">
              ${eq ? 'Equipped' : 'Equip'}
            </button>
          </div>
        </article>`;
    })
    .join('');
}

function renderInvDetail(item: InvItem | undefined, equipped: boolean): string {
  if (!item) {
    return `<div class="inv-detail-empty"><p>Select an item to preview details.</p></div>`;
  }
  return `
    <div class="inv-detail-art"><img src="${esc(item.img)}" alt="" /></div>
    <span class="${invRarityClass(item.rarity)}">${esc(item.rarity)}</span>
    <h3 class="inv-detail-name">${esc(item.name)}</h3>
    <p class="inv-detail-type">${esc(item.type)}</p>
    <p class="inv-detail-desc">${esc(item.desc)}</p>
    <dl class="inv-detail-meta">
      <div><dt>Collection</dt><dd>${esc(item.set)}</dd></div>
      <div><dt>Unlock</dt><dd>${esc(item.unlock)}</dd></div>
      <div><dt>Season</dt><dd>${esc(item.season)}</dd></div>
    </dl>
    <button type="button" class="inv-equip-btn inv-detail-equip${equipped ? ' is-on' : ''}" data-equip="${esc(item.name)}">
      ${equipped ? 'Equipped' : 'Equip'}
    </button>
  `;
}

export function openInventory(): void {
  cb.setActiveNav('inventory');
  const equipped = new Set<string>();
  let selected = INV_ITEMS[0]?.name || '';

  openPage({
    id: 'inventory',
    title: 'Inventory',
    subtitle: 'Cosmetics & unlocks',
    html: `
      <div class="inv-view">
        <section class="inv-hero">
          <div class="inv-hero-copy">
            <p class="inv-eyebrow">Collection · Season 01</p>
            <h2 class="inv-hero-title">Player <span class="dl-accent">inventory</span></h2>
            <p class="inv-hero-text">
              Manage cosmetics, frames, finishers, and seasonal unlocks.
              Equip your loadout and track collection progress.
            </p>
            <div class="inv-hero-meta">
              <span class="inv-chip">Level 24</span>
              <span class="inv-chip">${INV_ITEMS.length} items</span>
              <span class="inv-chip">72% complete</span>
              <span class="inv-chip"><span class="dl-dot"></span> 0 equipped</span>
            </div>
          </div>
          <div class="inv-hero-art" aria-hidden="true">
            <img src="/position/game-general-1.png" alt="" />
          </div>
        </section>

        <section class="inv-section">
          <div class="inv-stat-grid">
            <article class="inv-stat-card"><span class="inv-stat-label">Total items</span><strong>${INV_ITEMS.length}</strong></article>
            <article class="inv-stat-card"><span class="inv-stat-label">Equipped</span><strong id="inv-stat-equipped">0</strong></article>
            <article class="inv-stat-card"><span class="inv-stat-label">Legendary</span><strong>1</strong></article>
            <article class="inv-stat-card"><span class="inv-stat-label">Epic</span><strong>2</strong></article>
            <article class="inv-stat-card"><span class="inv-stat-label">Rare</span><strong>1</strong></article>
            <article class="inv-stat-card"><span class="inv-stat-label">Recently unlocked</span><strong>3</strong></article>
          </div>
        </section>

        <section class="inv-section inv-main">
          <div class="inv-toolbar">
            <label class="inv-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" id="inv-search" placeholder="Search inventory…" />
            </label>
            <select id="inv-category" class="inv-select" aria-label="Category">
              <option value="all">Category · All</option>
              <option value="Weapon Skin">Weapon Skin</option>
              <option value="Profile Badge">Profile Badge</option>
              <option value="Finisher">Finisher</option>
              <option value="Avatar Frame">Avatar Frame</option>
              <option value="Emote">Emote</option>
              <option value="Battle Pass">Battle Pass</option>
            </select>
            <select id="inv-rarity" class="inv-select" aria-label="Rarity">
              <option value="all">Rarity · All</option>
              <option value="Common">Common</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Legendary">Legendary</option>
              <option value="Premium">Premium</option>
            </select>
            <select id="inv-owned" class="inv-select" aria-label="Ownership">
              <option value="all">Ownership · All</option>
              <option value="equipped">Equipped</option>
              <option value="unequipped">Unequipped</option>
            </select>
            <select id="inv-sort" class="inv-select" aria-label="Sort">
              <option value="newest">Sort · Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>

          <div class="inv-layout">
            <div class="inv-grid" id="inv-grid">
              ${renderInvCards(INV_ITEMS, equipped, selected)}
            </div>
            <aside class="inv-detail" id="inv-detail">
              ${renderInvDetail(INV_ITEMS[0], false)}
            </aside>
          </div>
        </section>

        <section class="inv-section">
          <div class="inv-section-head">
            <p class="inv-eyebrow">Recent</p>
            <h3 class="inv-section-title">Recently <span class="dl-accent">unlocked</span></h3>
          </div>
          <div class="inv-recent">
            ${INV_ITEMS.slice(0, 4)
              .map(
                (item) => `
              <article class="inv-recent-card" data-pick="${esc(item.name)}">
                <img src="${esc(item.img)}" alt="" />
                <div>
                  <span class="${invRarityClass(item.rarity)}">${esc(item.rarity)}</span>
                  <h4>${esc(item.name)}</h4>
                  <p>${esc(item.type)}</p>
                </div>
              </article>`,
              )
              .join('')}
          </div>
        </section>

        <section class="inv-section">
          <div class="inv-section-head">
            <p class="inv-eyebrow">Progress</p>
            <h3 class="inv-section-title">Collection <span class="dl-accent">progress</span></h3>
          </div>
          <div class="inv-progress-panel">
            <div class="inv-progress-top">
              <div>
                <strong id="inv-progress-pct">72%</strong>
                <span>collection complete</span>
              </div>
              <div class="inv-progress-meta">
                <span>Missing · 8</span>
                <span>Categories · 4 / 6</span>
                <span>Season rewards · 2 left</span>
              </div>
            </div>
            <div class="inv-progress-bar"><span style="width:72%"></span></div>
          </div>
        </section>
      </div>
    `,
    onMount(root) {
      const grid = root.querySelector<HTMLElement>('#inv-grid')!;
      const detail = root.querySelector<HTMLElement>('#inv-detail')!;
      const search = root.querySelector<HTMLInputElement>('#inv-search')!;
      const category = root.querySelector<HTMLSelectElement>('#inv-category')!;
      const rarity = root.querySelector<HTMLSelectElement>('#inv-rarity')!;
      const owned = root.querySelector<HTMLSelectElement>('#inv-owned')!;
      const sort = root.querySelector<HTMLSelectElement>('#inv-sort')!;
      const equippedStat = root.querySelector<HTMLElement>('#inv-stat-equipped');
      const heroEquipChip = root.querySelector<HTMLElement>('.inv-hero-meta .inv-chip:last-child');

      const rarityRank: Record<string, number> = {
        Common: 1,
        Rare: 2,
        Epic: 3,
        Legendary: 4,
        Premium: 5,
      };

      const filtered = (): InvItem[] => {
        const q = search.value.trim().toLowerCase();
        let list = INV_ITEMS.filter((item) => {
          const qOk = !q || item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
          const cOk = category.value === 'all' || item.type === category.value;
          const rOk = rarity.value === 'all' || item.rarity === rarity.value;
          const oOk =
            owned.value === 'all' ||
            (owned.value === 'equipped' && equipped.has(item.name)) ||
            (owned.value === 'unequipped' && !equipped.has(item.name));
          return qOk && cOk && rOk && oOk;
        });

        const key = sort.value;
        list = list.slice().sort((a, b) => {
          if (key === 'name') return a.name.localeCompare(b.name);
          if (key === 'rarity') return (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0);
          if (key === 'oldest') return INV_ITEMS.indexOf(a) - INV_ITEMS.indexOf(b);
          return INV_ITEMS.indexOf(b) - INV_ITEMS.indexOf(a);
        });
        return list;
      };

      const syncEquipUi = (): void => {
        if (equippedStat) equippedStat.textContent = String(equipped.size);
        if (heroEquipChip) {
          heroEquipChip.innerHTML = `<span class="dl-dot"></span> ${equipped.size} equipped`;
        }
      };

      const bind = (): void => {
        grid.querySelectorAll<HTMLElement>('.inv-item-card').forEach((card) => {
          card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-equip]')) return;
            selected = card.dataset.name || selected;
            refresh(false);
          });
        });

        root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.equip || '';
            if (!name) return;
            if (equipped.has(name)) {
              equipped.delete(name);
              showToast('Item unequipped');
            } else {
              equipped.add(name);
              showToast('Item equipped');
            }
            selected = name;
            syncEquipUi();
            refresh(false);
          });
        });
      };

      const refresh = (refilter = true): void => {
        const list = refilter ? filtered() : filtered();
        if (!list.find((i) => i.name === selected) && list[0]) selected = list[0].name;
        grid.innerHTML = renderInvCards(list, equipped, selected);
        const item = INV_ITEMS.find((i) => i.name === selected) || list[0];
        detail.innerHTML = renderInvDetail(item, !!(item && equipped.has(item.name)));
        bind();
      };

      search.addEventListener('input', () => refresh());
      category.addEventListener('change', () => refresh());
      rarity.addEventListener('change', () => refresh());
      owned.addEventListener('change', () => refresh());
      sort.addEventListener('change', () => refresh());

      root.querySelectorAll<HTMLElement>('[data-pick]').forEach((el) => {
        el.addEventListener('click', () => {
          selected = el.dataset.pick || selected;
          refresh(false);
          detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });

      bind();
      syncEquipUi();
    },
  });
}

export function openHowToPlay(): void {
  openPage({
    id: 'how-to-play',
    title: 'HOW TO PLAY',
    subtitle: 'Controls & objective',
    html: `
      <div class="page-card">
        <h3 class="page-h3">Controls</h3>
        <ul class="page-list">
          <li><kbd>A</kbd>/<kbd>D</kbd> or ←/→ — Move</li>
          <li><kbd>W</kbd>/<kbd>Space</kbd>/↑ — Jump</li>
          <li><kbd>J</kbd>/<kbd>Z</kbd> — Attack (leave energy links)</li>
          <li><kbd>K</kbd>/<kbd>X</kbd> — Dash</li>
        </ul>
        <h3 class="page-h3">Objective</h3>
        <p class="page-text">Your links speed you up; enemy links slow you. Connect three links into a triangle to form an Energy Zone. The highest energy when the timer hits zero wins.</p>
      </div>
    `,
    onMount(root) {
      root.querySelector('#htp-play')?.addEventListener('click', () => cb.showGame());
    },
  });
}

export function openCustomLobby(): void {
  const code = `LINK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  openPage({
    id: 'custom-lobby',
    title: 'CUSTOM LOBBY',
    subtitle: 'Private match',
    html: `
      <div class="page-card">
        <div class="page-stat-grid">
          <div class="page-stat">Lobby code<strong>${code}</strong></div>
          <div class="page-stat">Slots<strong>1 / 8</strong></div>
          <div class="page-stat">Map<strong>Random</strong></div>
          <div class="page-stat">Rules<strong>Standard</strong></div>
        </div>
        <div class="page-actions">
          <button type="button" class="page-btn" id="lobby-copy">COPY CODE</button>
          <button type="button" class="page-btn primary" id="lobby-start">ENTER ARENA</button>
        </div>
      </div>
    `,
    onMount(root) {
      root.querySelector('#lobby-copy')?.addEventListener('click', () => {
        void navigator.clipboard?.writeText(code);
        showToast(`Copied ${code}`);
      });
      root.querySelector('#lobby-start')?.addEventListener('click', () => cb.showGame());
    },
  });
}

const LEADERS = [
  ['ShadowLink', 'CHAMPION', '3,450', '82%', '9'],
  ['NeonX', 'MASTER', '3,210', '78%', '7'],
  ['CyberNull', 'DIAMOND', '2,980', '74%', '5'],
  ['PulseFire', 'ELITE', '2,750', '70%', '4'],
  ['LinkMaster', 'LEGEND', '2,540', '66%', '3'],
  ['VoltArrow', 'ELITE', '2,410', '63%', '2'],
  ['GridWalker', 'DIAMOND', '2,290', '61%', '6'],
  ['ApexNode', 'MASTER', '2,175', '59%', '1'],
];

const LB_CLANS = ['NX', 'VL', 'CR', 'PF', 'LM', 'VA', 'GW', 'AN'];

function lbLeagueClass(league: string): string {
  return `lb-badge lb-badge--${league.toLowerCase()}`;
}

function renderLeaderRows(list: typeof LEADERS): string {
  return list
    .map(([n, lg, r, w, s], i) => {
      const realIdx = LEADERS.findIndex((row) => row[0] === n);
      const idx = realIdx >= 0 ? realIdx : i;
      const top = i < 3 ? ` is-top-${i + 1}` : '';
      return `
        <button type="button" class="page-tr lb-row${top}" data-idx="${idx}">
          <span class="lb-pos">${i + 1}</span>
          <span class="lb-player">
            <img src="/position/image${(idx % 4) + 1}.png" alt="" />
            <span class="lb-player-meta">
              <span class="lb-player-name">${esc(n)}<span class="lb-online" title="Online"></span></span>
              <span class="lb-clan">[${esc(LB_CLANS[idx % LB_CLANS.length])}]</span>
            </span>
          </span>
          <span><span class="${lbLeagueClass(lg)}">${esc(lg)}</span></span>
          <span class="lb-rating">${esc(r)}</span>
          <span>${esc(w)}</span>
          <span class="lb-streak">${esc(s)}</span>
        </button>`;
    })
    .join('');
}

export function openRanking(): void {
  cb.setActiveNav('ranking');
  openPage({
    id: 'ranking',
    title: 'Leaderboard',
    subtitle: 'Season 1 · global standings',
    html: `
      <div class="lb-view">
        <section class="lb-hero">
          <p class="lb-eyebrow">Competitive · Season 01</p>
          <h2 class="lb-hero-title">Global <span class="dl-accent">Leaderboard</span></h2>
          <p class="lb-hero-text">
            Climb ranked, defend your league, and take the crown. Standings update after every rated match.
          </p>
          <div class="lb-hero-meta">
            <span class="lb-chip"><span class="dl-dot"></span> 24,582 online</span>
            <span class="lb-chip">Season live</span>
            <span class="lb-chip">Updated 2m ago</span>
            <span class="lb-chip">Region · Global</span>
          </div>
        </section>

        <section class="lb-section">
          <div class="lb-stat-grid">
            <article class="lb-stat-card"><span class="lb-stat-label">Total players</span><strong>128,440</strong></article>
            <article class="lb-stat-card"><span class="lb-stat-label">Active today</span><strong>18,902</strong></article>
            <article class="lb-stat-card"><span class="lb-stat-label">Highest rating</span><strong>3,450</strong></article>
            <article class="lb-stat-card"><span class="lb-stat-label">Current champion</span><strong>ShadowLink</strong></article>
            <article class="lb-stat-card"><span class="lb-stat-label">Ranked matches</span><strong>2.4M</strong></article>
            <article class="lb-stat-card"><span class="lb-stat-label">Current season</span><strong>Season 01</strong></article>
          </div>
        </section>

        <section class="lb-section">
          <div class="lb-toolbar">
            <label class="lb-search">
              <span class="lb-search-ico" aria-hidden="true">⌕</span>
              <input type="search" id="lb-search" placeholder="Search player…" />
            </label>
            <select id="lb-region" class="lb-select" aria-label="Region">
              <option value="global">Region · Global</option>
              <option value="na">North America</option>
              <option value="eu">Europe</option>
              <option value="asia">Asia</option>
            </select>
            <select id="lb-season" class="lb-select" aria-label="Season">
              <option value="1">Season 01</option>
              <option value="0">Preseason</option>
            </select>
            <select id="lb-mode" class="lb-select" aria-label="Mode">
              <option value="ranked">Mode · Ranked</option>
              <option value="solo">Solo queue</option>
              <option value="duo">Duo</option>
            </select>
            <select id="lb-league" class="lb-select" aria-label="League">
              <option value="all">League · All</option>
              <option value="CHAMPION">Champion</option>
              <option value="MASTER">Master</option>
              <option value="DIAMOND">Diamond</option>
              <option value="ELITE">Elite</option>
              <option value="LEGEND">Legend</option>
            </select>
            <select id="lb-sort" class="lb-select" aria-label="Sort">
              <option value="rating">Sort · Rating</option>
              <option value="win">Win %</option>
              <option value="streak">Streak</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div class="page-table lb-table" id="lb-table">
            <div class="page-tr head lb-head">
              <span>#</span><span>Player</span><span>League</span><span>Rating</span><span>Win %</span><span>Streak</span>
            </div>
            <div class="lb-table-body" id="lb-table-body">
              ${renderLeaderRows(LEADERS)}
            </div>
          </div>
        </section>

        <section class="lb-section">
          <div class="lb-section-head">
            <p class="lb-eyebrow">Season 01</p>
            <h3 class="lb-section-title">Season <span class="dl-accent">rewards</span></h3>
          </div>
          <div class="lb-reward-grid">
            <article class="lb-reward-card"><span class="lb-reward-tier">Top 1%</span><h4>Champion Frame</h4><p>Exclusive avatar border and title.</p></article>
            <article class="lb-reward-card"><span class="lb-reward-tier">Top 5%</span><h4>Master Badge</h4><p>Season badge and XP boost.</p></article>
            <article class="lb-reward-card"><span class="lb-reward-tier">Top 15%</span><h4>Diamond Spray</h4><p>Limited spray and name color.</p></article>
            <article class="lb-reward-card"><span class="lb-reward-tier">Qualified</span><h4>Season Token</h4><p>Currency for the next shop rotation.</p></article>
          </div>
        </section>

        <section class="lb-section lb-split">
          <div>
            <div class="lb-section-head">
              <p class="lb-eyebrow">Rules</p>
              <h3 class="lb-section-title">Ranking <span class="dl-accent">information</span></h3>
            </div>
            <div class="lb-info-grid">
              <article class="lb-info-card"><h4>Rating</h4><p>Wins and performance adjust LP after each ranked match.</p></article>
              <article class="lb-info-card"><h4>Promotion</h4><p>Reach league thresholds to unlock the next tier.</p></article>
              <article class="lb-info-card"><h4>Demotion</h4><p>Falling below a soft floor risks demotion after grace matches.</p></article>
              <article class="lb-info-card"><h4>Matchmaking</h4><p>Queues pair similar ratings within your selected region.</p></article>
            </div>
          </div>
          <div>
            <div class="lb-section-head">
              <p class="lb-eyebrow">Live</p>
              <h3 class="lb-section-title">Competitive <span class="dl-accent">stats</span></h3>
            </div>
            <div class="lb-comp-grid">
              <article class="lb-stat-card"><span class="lb-stat-label">Avg. win rate</span><strong>54%</strong></article>
              <article class="lb-stat-card"><span class="lb-stat-label">Most active league</span><strong>Diamond</strong></article>
              <article class="lb-stat-card"><span class="lb-stat-label">Highest streak</span><strong>9</strong></article>
              <article class="lb-stat-card"><span class="lb-stat-label">Average rating</span><strong>2,601</strong></article>
            </div>
          </div>
        </section>
      </div>
    `,
    onMount(root) {
      const body = root.querySelector<HTMLElement>('#lb-table-body')!;
      const search = root.querySelector<HTMLInputElement>('#lb-search')!;
      const league = root.querySelector<HTMLSelectElement>('#lb-league')!;
      const sort = root.querySelector<HTMLSelectElement>('#lb-sort')!;

      const bindRows = (): void => {
        body.querySelectorAll<HTMLButtonElement>('.lb-row').forEach((row) =>
          row.addEventListener('click', () => openPlayer(Number(row.dataset.idx))),
        );
      };

      const refresh = (): void => {
        const q = search.value.trim().toLowerCase();
        const lg = league.value;
        let rows = LEADERS.map((row, i) => ({ row, i })).filter(({ row }) => {
          const nameOk = !q || row[0].toLowerCase().includes(q);
          const leagueOk = lg === 'all' || row[1] === lg;
          return nameOk && leagueOk;
        });

        const key = sort.value;
        rows = rows.slice().sort((a, b) => {
          if (key === 'name') return a.row[0].localeCompare(b.row[0]);
          if (key === 'win') return parseFloat(b.row[3]) - parseFloat(a.row[3]);
          if (key === 'streak') return Number(b.row[4]) - Number(a.row[4]);
          return Number(String(b.row[2]).replace(/,/g, '')) - Number(String(a.row[2]).replace(/,/g, ''));
        });

        body.innerHTML = renderLeaderRows(rows.map((r) => r.row));
        bindRows();
      };

      search.addEventListener('input', refresh);
      league.addEventListener('change', refresh);
      sort.addEventListener('change', refresh);
      root.querySelector('#lb-region')?.addEventListener('change', () => showToast('Region filter applied'));
      root.querySelector('#lb-season')?.addEventListener('change', () => showToast('Season filter applied'));
      root.querySelector('#lb-mode')?.addEventListener('change', () => showToast('Mode filter applied'));
      bindRows();
    },
  });
}

export function openPlayer(idx: number): void {
  const p = LEADERS[idx] ?? LEADERS[0];
  const [name, league, rating, winRate, streak] = p;
  openPage({
    id: 'player',
    title: name,
    subtitle: `${league} · Rank #${idx + 1}`,
    html: `
      <div class="page-card page-profile">
        <div class="page-profile-top">
          <div class="page-avatar"><img src="/position/image${(idx % 4) + 1}.png" alt="" /></div>
          <div>
            <h2 class="page-profile-name">${esc(name)}</h2>
            <p class="page-badge">${esc(league)} · Season 1</p>
          </div>
        </div>
        <div class="page-stat-grid">
          <div class="page-stat">Rating<strong>${rating}</strong></div>
          <div class="page-stat">Win rate<strong>${winRate}</strong></div>
          <div class="page-stat">Streak<strong>${streak}</strong></div>
          <div class="page-stat">Rank<strong>#${idx + 1}</strong></div>
        </div>
        <div class="page-actions">
          <button type="button" class="page-btn primary" id="player-chat">MESSAGE</button>
          <button type="button" class="page-btn" id="player-challenge">CHALLENGE</button>
        </div>
      </div>
    `,
    onMount(root) {
      root.querySelector('#player-chat')?.addEventListener('click', () => {
        cb.setActiveNav('chat');
        cb.showChat();
      });
      root.querySelector('#player-challenge')?.addEventListener('click', () =>
        showToast(`Challenge sent to ${name}`),
      );
    },
  });
}

const MISSIONS = [
  ['Play 3 Matches', 'Complete three online matches in any mode.', '2 / 3', 66, '500'],
  ['Capture 10 Nodes', 'Capture objective nodes during multiplayer battles.', '6 / 10', 60, '700'],
  ['Win 2 Matches', 'Achieve two victories to earn bonus experience.', '1 / 2', 50, '600'],
  ['Form 5 Zones', 'Create five Energy Zones across matches.', '3 / 5', 60, '450'],
  ['Deal 20 Attacks', 'Land twenty attack links on opponents.', '14 / 20', 70, '400'],
];

export function openMissions(): void {
  openPage({
    id: 'missions',
    title: 'DAILY MISSIONS',
    subtitle: 'Resets in 12h 45m',
    html: `
      <div class="page-grid cols-1">
        ${MISSIONS.map(
          ([t, d, c, pct, xp], i) => `
          <div class="page-card mission-row">
            <div class="mission-info">
              <h3>${t}</h3>
              <p>${d}</p>
              <div class="page-bar"><span style="width:${pct}%"></span></div>
            </div>
            <div class="mission-side">
              <span class="mission-xp">⚡ XP ${xp}</span>
              <span class="mission-count">${c}</span>
              <button type="button" class="page-btn sm mission-track" data-idx="${i}">TRACK</button>
            </div>
          </div>`,
        ).join('')}
      </div>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.mission-track').forEach((b) =>
        b.addEventListener('click', () => {
          const on = b.classList.toggle('is-tracking');
          b.textContent = on ? 'TRACKING ✓' : 'TRACK';
          showToast(on ? 'Mission tracked' : 'Tracking removed');
        }),
      );
    },
  });
}

export function openEvent(): void {
  openPage({
    id: 'event',
    title: 'NEON STORM',
    subtitle: 'Limited-time event · ends in 6d 12h 45m',
    html: `
      <div class="page-hero-banner">
        <img src="/position/NEON%20STORM.png" alt="" />
        <div class="page-hero-overlay"></div>
        <div class="page-hero-text"><h2>NEON STORM</h2><p>Complete missions and earn exclusive rewards.</p></div>
      </div>
      <div class="page-stat-grid">
        <div class="page-stat">Progress<strong>3 / 10</strong></div>
        <div class="page-stat">Event currency<strong>240</strong></div>
      </div>
      <div class="page-grid cols-4 event-tabs">
        <button type="button" class="page-tab-card" data-tab="Challenges">🏆<span>Challenges</span></button>
        <button type="button" class="page-tab-card" data-tab="Rewards">🎁<span>Rewards</span></button>
        <button type="button" class="page-tab-card" data-tab="Leaderboard">📊<span>Leaderboard</span></button>
        <button type="button" class="page-tab-card" data-tab="Store">🛍️<span>Store</span></button>
      </div>
      <div class="page-actions">
        <button type="button" class="page-btn primary" id="event-join">JOIN EVENT</button>
      </div>
    `,
    onMount(root) {
      root.querySelector('#event-join')?.addEventListener('click', () =>
        showToast('Neon Storm joined — challenges unlocked'),
      );
      root.querySelectorAll<HTMLButtonElement>('.page-tab-card').forEach((b) =>
        b.addEventListener('click', () => {
          const tab = b.dataset.tab || 'Challenges';
          if (tab === 'Leaderboard') {
            openRanking();
            return;
          }
          openEventTab(tab);
        }),
      );
    },
  });
}

function openEventTab(tab: string): void {
  const copy: Record<string, string> = {
    Challenges: 'Complete 10 event missions before the timer ends to earn the full reward track.',
    Rewards: 'Claim XP boosts, an exclusive skin, a player badge, and Neon Storm currency.',
    Store: 'Spend event currency on limited-time cosmetics and finishers.',
  };
  openPage({
    id: `event-${tab.toLowerCase()}`,
    title: `NEON STORM — ${tab.toUpperCase()}`,
    html: `<div class="page-card"><p class="page-text">${copy[tab] ?? 'Event feature ready.'}</p></div>`,
  });
}

export interface ArticleData {
  title: string;
  badge: string;
  date: string;
  desc: string;
  img?: string;
}

export function openArticle(a: ArticleData): void {
  openPage({
    id: 'article',
    title: a.title,
    subtitle: `${a.badge} · ${a.date}`,
    html: `
      ${a.img ? `<div class="page-hero-banner sm"><img src="${a.img}" alt="" /></div>` : ''}
      <div class="page-card">
        <p class="page-text">${esc(a.desc)}</p>
        <p class="page-text">Stay tuned for more seasonal content, balance changes, and community events. Follow our channels for the latest LINK news.</p>
      </div>
    `,
  });
}

export function openNewsList(items: ArticleData[]): void {
  openPage({
    id: 'news',
    title: 'NEWS & UPDATES',
    subtitle: 'All articles',
    html: `
      <div class="page-grid cols-1">
        ${items
          .map(
            (a, i) => `
          <button type="button" class="page-card news-row" data-idx="${i}">
            ${a.img ? `<img class="news-row-thumb" src="${a.img}" alt="" />` : ''}
            <div>
              <span class="news-row-badge">${esc(a.badge)}</span>
              <h3>${esc(a.title)}</h3>
              <p>${esc(a.desc)}</p>
              <span class="news-row-date">${esc(a.date)}</span>
            </div>
          </button>`,
          )
          .join('')}
      </div>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.news-row').forEach((row) =>
        row.addEventListener('click', () => openArticle(items[Number(row.dataset.idx)])),
      );
    },
  });
}

const COMMUNITY_NEWS: ArticleData[] = [
  {
    title: 'Season 01 Circuit Open',
    badge: 'Competitive',
    date: 'Jul 18, 2026',
    desc: 'Ranked brackets are live. Climb the ladder and earn season rewards.',
    img: '/position/news-updates-1.png',
  },
  {
    title: 'Community Clip Contest',
    badge: 'Creators',
    date: 'Jul 12, 2026',
    desc: 'Share your best LINK plays. Winners get exclusive badges and credits.',
    img: '/position/news-updates-2.png',
  },
  {
    title: 'Patch 0.1.0 Notes',
    badge: 'Update',
    date: 'Jul 8, 2026',
    desc: 'Balance tweaks, queue improvements, and quality-of-life fixes.',
    img: '/position/news-updates-3.png',
  },
];

export function openCommunity(): void {
  cb.setActiveNav('community');
  openPage({
    id: 'community',
    title: 'Community',
    subtitle: 'Connect with players worldwide',
    html: `
      <div class="cm-view">
        <section class="cm-hero">
          <div class="cm-hero-art">
            <img src="/position/JOIN%20OUR%20COMMUNITY.png" alt="" />
            <div class="cm-hero-veil" aria-hidden="true"></div>
          </div>
          <div class="cm-hero-copy">
            <p class="cm-eyebrow">Players · Official hub</p>
            <h2 class="cm-hero-title">Join our <span class="dl-accent">community</span></h2>
            <p class="cm-hero-text">
              Compete, share clips, and stay updated on seasons and events.
              Meet teammates and talk directly with the LINK team.
            </p>
            <div class="cm-hero-meta">
              <span class="cm-chip"><span class="dl-dot"></span> 12,840 members</span>
              <span class="cm-chip">3,210 online</span>
              <span class="cm-chip">Server · Online</span>
              <span class="cm-chip">Discord verified</span>
            </div>
            <div class="cm-hero-actions">
              <button type="button" class="cm-btn-primary" id="cm-discord">Join Discord</button>
              <button type="button" class="cm-btn-secondary" id="cm-news">Latest News</button>
            </div>
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-stat-grid">
            <article class="cm-stat-card"><span class="cm-stat-label">Total members</span><strong>12,840</strong></article>
            <article class="cm-stat-card"><span class="cm-stat-label">Members online</span><strong>3,210</strong></article>
            <article class="cm-stat-card"><span class="cm-stat-label">Discord status</span><strong>Online</strong></article>
            <article class="cm-stat-card"><span class="cm-stat-label">Weekly events</span><strong>8</strong></article>
            <article class="cm-stat-card"><span class="cm-stat-label">Active teams</span><strong>640</strong></article>
            <article class="cm-stat-card"><span class="cm-stat-label">Tournaments</span><strong>12</strong></article>
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-section-head">
            <p class="cm-eyebrow">Calendar</p>
            <h3 class="cm-section-title">Upcoming <span class="dl-accent">events</span></h3>
          </div>
          <div class="cm-event-grid">
            ${cmEvent('Weekly Tournament', 'Sat · Jul 25', '18:00 UTC', 'Open', 'Join')}
            ${cmEvent('Community Scrims', 'Sun · Jul 26', '16:00 UTC', 'Open', 'Join')}
            ${cmEvent('Developer Q&A', 'Wed · Jul 29', '20:00 UTC', 'Soon', 'Remind')}
            ${cmEvent('Seasonal Event', 'Fri · Aug 1', 'All day', 'Soon', 'Details')}
            ${cmEvent('Livestream', 'Fri · Jul 24', '19:30 UTC', 'Live', 'Watch')}
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-section-head">
            <p class="cm-eyebrow">Resources</p>
            <h3 class="cm-section-title">Community <span class="dl-accent">features</span></h3>
          </div>
          <div class="cm-feature-grid">
            ${cmFeature('Official Discord', 'Chat, LFG, and patch talk with the community.', 'Open', 'discord')}
            ${cmFeature('News & Updates', 'Patch notes, seasons, and announcements.', 'Read', 'news')}
            ${cmFeature('Voice Chat', 'Jump into party channels for scrims and ranked.', 'Join', 'voice')}
            ${cmFeature('Player Support', 'Get help from mods and the LINK team.', 'Support', 'support')}
            ${cmFeature('Team Recruitment', 'Find a squad or post your open roster.', 'Recruit', 'team')}
            ${cmFeature('Community Events', 'Tournaments, contests, and creator drops.', 'Browse', 'events')}
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-section-head">
            <p class="cm-eyebrow">Announcements</p>
            <h3 class="cm-section-title">Featured <span class="dl-accent">news</span></h3>
          </div>
          <div class="cm-news-grid">
            ${COMMUNITY_NEWS.map(
              (a, i) => `
              <article class="cm-news-card" data-news="${i}">
                <div class="cm-news-thumb"><img src="${esc(a.img || '')}" alt="" /></div>
                <div class="cm-news-body">
                  <span class="cm-news-meta">${esc(a.badge)} · ${esc(a.date)}</span>
                  <h4>${esc(a.title)}</h4>
                  <p>${esc(a.desc)}</p>
                  <button type="button" class="cm-btn-secondary cm-news-read" data-news="${i}">Read more</button>
                </div>
              </article>`,
            ).join('')}
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-section-head">
            <p class="cm-eyebrow">Spotlight</p>
            <h3 class="cm-section-title">Featured <span class="dl-accent">creators</span></h3>
          </div>
          <div class="cm-creator-grid">
            ${cmCreator('Nyx', 'Caster', 'Ranked', '18.2K', 1)}
            ${cmCreator('Volt', 'Clip editor', 'Customs', '9.4K', 2)}
            ${cmCreator('Echo', 'Coach', 'Training', '12.1K', 3)}
            ${cmCreator('Rift', 'Streamer', 'Tournaments', '21.8K', 4)}
          </div>
        </section>

        <section class="cm-section">
          <div class="cm-section-head">
            <p class="cm-eyebrow">Gallery</p>
            <h3 class="cm-section-title">Community <span class="dl-accent">shots</span></h3>
          </div>
          <div class="cm-gallery">
            <figure class="cm-gallery-card"><img src="/position/game-banner-wide-1.png" alt="" /></figure>
            <figure class="cm-gallery-card"><img src="/position/game-banner-wide-2.png" alt="" /></figure>
            <figure class="cm-gallery-card"><img src="/position/game-community-placeholder.png" alt="" /></figure>
            <figure class="cm-gallery-card"><img src="/position/game-hero-placeholder.png" alt="" /></figure>
          </div>
        </section>

        <section class="cm-cta">
          <p class="cm-eyebrow">Ready up</p>
          <h3 class="cm-cta-title">Join Discord. Meet players. Compete together.</h3>
          <p class="cm-cta-text">Create your team, queue ranked, and stay close to seasons, patches, and events.</p>
          <div class="cm-hero-actions">
            <button type="button" class="cm-btn-primary" id="cm-discord-bottom">Join Discord</button>
            <button type="button" class="cm-btn-secondary" id="cm-news-bottom">Latest News</button>
          </div>
        </section>
      </div>
    `,
    onMount(root) {
      const openDiscord = (): void => {
        openDiscordInvite();
        showToast('Opening Discord…');
      };
      const openNews = (): void => openNewsList(COMMUNITY_NEWS);

      root.querySelector('#cm-discord')?.addEventListener('click', openDiscord);
      root.querySelector('#cm-discord-bottom')?.addEventListener('click', openDiscord);
      root.querySelector('#cm-news')?.addEventListener('click', openNews);
      root.querySelector('#cm-news-bottom')?.addEventListener('click', openNews);

      root.querySelectorAll<HTMLElement>('.cm-news-card').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.news);
          const article = COMMUNITY_NEWS[idx];
          if (article) openArticle(article);
        });
      });

      root.querySelectorAll<HTMLButtonElement>('.cm-event-join').forEach((btn) => {
        btn.addEventListener('click', () => showToast(`${btn.dataset.event || 'Event'} — thanks for joining`));
      });

      root.querySelectorAll<HTMLButtonElement>('.cm-feature-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act || '';
          if (act === 'discord' || act === 'voice') openDiscord();
          else if (act === 'news') openNews();
          else showToast('Opening community feature…');
        });
      });
    },
  });
}

function cmEvent(title: string, date: string, time: string, status: string, action: string): string {
  return `
    <article class="cm-event-card">
      <div class="cm-event-top">
        <span class="cm-event-status">${esc(status)}</span>
        <h4>${esc(title)}</h4>
      </div>
      <p class="cm-event-meta">${esc(date)} · ${esc(time)}</p>
      <button type="button" class="cm-btn-secondary cm-event-join" data-event="${esc(title)}">${esc(action)}</button>
    </article>
  `;
}

function cmFeature(title: string, desc: string, action: string, act: string): string {
  return `
    <article class="cm-feature-card">
      <h4>${esc(title)}</h4>
      <p>${esc(desc)}</p>
      <button type="button" class="cm-btn-secondary cm-feature-btn" data-act="${esc(act)}">${esc(action)}</button>
    </article>
  `;
}

function cmCreator(name: string, role: string, mode: string, followers: string, img: number): string {
  return `
    <article class="cm-creator-card">
      <img src="/position/image${img}.png" alt="" />
      <div>
        <h4>${esc(name)}</h4>
        <p>${esc(role)} · ${esc(mode)}</p>
        <span class="cm-creator-followers">${esc(followers)} followers</span>
      </div>
    </article>
  `;
}

const OTHER_PLATFORMS: { os: string; file: string; status: string }[] = [
  { os: 'macOS', file: 'LINK-Installer-macOS.dmg', status: 'Coming soon' },
  { os: 'Android', file: 'LINK-Android.apk', status: 'Coming soon' },
  { os: 'iOS', file: 'LINK-iOS.ipa', status: 'Coming soon' },
];

const WINDOWS_FILE = 'LINK-Setup-Windows.exe';

function downloadGlyph(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
}

function dlIcon(kind: string): string {
  const icons: Record<string, string> = {
    windows: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7.1H3v6Zm8.5 1.2L21 21V12.5h-9.5v7.2ZM12.5 11.5H21V3l-8.5 1.2v7.3Z"/></svg>`,
    apple: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 13.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1 1-3.9 2.5-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2-.1 1.6-.7 3.1-.7s1.8.7 3.1.7c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.7-3.4ZM14.7 5.8c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 0 2-.5 2.6-1.3Z"/></svg>`,
    android: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.2 16.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9.6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM5.1 8.7l-1.3-2.2a.5.5 0 0 1 .2-.7.5.5 0 0 1 .7.2l1.3 2.2A8.4 8.4 0 0 1 12 6.5c1.9 0 3.6.6 5 1.7l1.3-2.2a.5.5 0 0 1 .7-.2.5.5 0 0 1 .2.7l-1.3 2.2A7.9 7.9 0 0 1 20 14.2v.6H4v-.6c0-2.1.8-4 2.1-5.5Z"/></svg>`,
    cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>`,
    memory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v12M11 6v12M15 6v12M7 10h4"/></svg>`,
    gpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h2"/></svg>`,
    storage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
    os: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`,
    directx: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M12 12 20 7.5M12 12v9M12 12 4 7.5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20 6 9 17l-5-5"/></svg>`,
    version: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z"/></svg>`,
  };
  return icons[kind] || downloadGlyph();
}

/** LINK is an app game — PLAY opens this download page with a centered Windows button. */
export function openDownload(): void {
  cb.setActiveNav('download');
  openPage({
    id: 'download',
    title: 'Download',
    subtitle: 'Get the LINK app game for your device',
    html: `
      <div class="dl-view">
        <section class="dl-hero">
          <div class="dl-hero-mark" aria-hidden="true">LINK</div>
          <p class="dl-eyebrow">PC launcher · Open beta</p>
          <h2 class="dl-hero-title">Download for <span class="dl-accent">Windows</span></h2>
          <p class="dl-hero-text">
            Install LINK on your PC and jump into ranked, custom lobbies, and training.
            Lightweight client. Competitive focus.
          </p>
          <button type="button" class="dl-main-btn" data-os="Windows" data-file="${esc(WINDOWS_FILE)}">
            <span class="dl-main-icon">${downloadGlyph()}</span>
            <span class="dl-main-label">Download for Windows</span>
          </button>
          <div class="dl-hero-meta">
            <span class="dl-chip">Version 0.1.0</span>
            <span class="dl-chip">~120 MB</span>
            <span class="dl-chip">Windows 10 / 11 · 64-bit</span>
            <span class="dl-chip dl-chip--live"><span class="dl-dot"></span> Available now</span>
          </div>
        </section>

        <section class="dl-section">
          <div class="dl-section-head">
            <p class="dl-eyebrow">Build info</p>
            <h3 class="dl-section-title">Download information</h3>
          </div>
          <div class="dl-info-grid">
            ${infoCard('version', 'Latest version', '0.1.0')}
            ${infoCard('calendar', 'Release date', 'Jul 2026')}
            ${infoCard('storage', 'File size', '~120 MB')}
            ${infoCard('windows', 'Platform', 'Windows')}
            ${infoCard('cpu', 'Architecture', '64-bit')}
            ${infoCard('shield', 'Status', 'Open beta')}
          </div>
        </section>

        <section class="dl-section">
          <div class="dl-section-head">
            <p class="dl-eyebrow">Specs</p>
            <h3 class="dl-section-title">System <span class="dl-accent">requirements</span></h3>
          </div>
          <div class="dl-req-grid">
            <article class="dl-req-card">
              <h4 class="dl-req-label">Minimum</h4>
              ${reqRow('os', 'Operating system', 'Windows 10 64-bit')}
              ${reqRow('cpu', 'Processor', 'Intel i5 / Ryzen 5')}
              ${reqRow('memory', 'Memory', '8 GB RAM')}
              ${reqRow('gpu', 'Graphics', 'GTX 1050 / RX 560')}
              ${reqRow('storage', 'Storage', '2 GB available')}
              ${reqRow('directx', 'DirectX', 'Version 11')}
            </article>
            <article class="dl-req-card dl-req-card--rec">
              <h4 class="dl-req-label">Recommended</h4>
              ${reqRow('os', 'Operating system', 'Windows 11 64-bit')}
              ${reqRow('cpu', 'Processor', 'Intel i7 / Ryzen 7')}
              ${reqRow('memory', 'Memory', '16 GB RAM')}
              ${reqRow('gpu', 'Graphics', 'RTX 3060 / RX 6700')}
              ${reqRow('storage', 'Storage', '4 GB SSD')}
              ${reqRow('directx', 'DirectX', 'Version 12')}
            </article>
          </div>
        </section>

        <section class="dl-section">
          <div class="dl-section-head">
            <p class="dl-eyebrow">Setup</p>
            <h3 class="dl-section-title">Installation <span class="dl-accent">guide</span></h3>
          </div>
          <div class="dl-steps">
            ${stepCard('01', 'Download installer', 'Get the Windows setup file from the button above.')}
            ${stepCard('02', 'Run installer', 'Open the .exe and follow the on-screen steps.')}
            ${stepCard('03', 'Sign in', 'Launch LINK and sign in with your account.')}
            ${stepCard('04', 'Start playing', 'Queue ranked, customs, or training and go.')}
          </div>
        </section>

        <section class="dl-section">
          <div class="dl-section-head">
            <p class="dl-eyebrow">More devices</p>
            <h3 class="dl-section-title">Other <span class="dl-accent">platforms</span></h3>
          </div>
          <div class="dl-platform-grid">
            <article class="dl-platform-card dl-platform-card--ready">
              <span class="dl-platform-icon">${dlIcon('windows')}</span>
              <div class="dl-platform-meta">
                <h4>Windows</h4>
                <p>Available now</p>
              </div>
              <button type="button" class="dl-platform-btn" data-os="Windows" data-file="${esc(WINDOWS_FILE)}">
                ${downloadGlyph()} Download
              </button>
            </article>
            ${OTHER_PLATFORMS.map(
              (p) => `
              <article class="dl-platform-card">
                <span class="dl-platform-icon">${dlIcon(p.os === 'macOS' ? 'apple' : p.os.toLowerCase())}</span>
                <div class="dl-platform-meta">
                  <h4>${esc(p.os)}</h4>
                  <p>${esc(p.status)}</p>
                </div>
                <button type="button" class="dl-platform-btn is-soon" data-os="${esc(p.os)}" data-file="${esc(p.file)}">
                  Coming soon
                </button>
              </article>`,
            ).join('')}
          </div>
        </section>
      </div>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('[data-os]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const os = btn.dataset.os || 'your device';
          const file = btn.dataset.file || 'LINK-Setup';
          if (os === 'Windows') {
            triggerDownload(file, os);
            showToast('Downloading LINK for Windows…');
          } else {
            showToast(`The ${os} version is not yet available — coming soon.`);
          }
        });
      });
    },
  });
}

function infoCard(icon: string, label: string, value: string): string {
  return `
    <article class="dl-info-card">
      <span class="dl-info-icon">${dlIcon(icon)}</span>
      <span class="dl-info-label">${esc(label)}</span>
      <strong class="dl-info-value">${esc(value)}</strong>
    </article>
  `;
}

function reqRow(icon: string, label: string, value: string): string {
  return `
    <div class="dl-req-row">
      <span class="dl-req-icon">${dlIcon(icon)}</span>
      <div>
        <span class="dl-req-key">${esc(label)}</span>
        <strong class="dl-req-val">${esc(value)}</strong>
      </div>
    </div>
  `;
}

function stepCard(num: string, title: string, text: string): string {
  return `
    <article class="dl-step-card">
      <span class="dl-step-num">${esc(num)}</span>
      <h4 class="dl-step-title">${esc(title)}</h4>
      <p class="dl-step-text">${esc(text)}</p>
    </article>
  `;
}

const FORTUNES: { icon: string; title: string; text: string }[] = [
  { icon: '💰', title: 'Jackpot!', text: 'You found 500 credits. Fortune favors the bold today.' },
  { icon: '⚡', title: 'Power Surge', text: 'Double XP is yours for your next 3 matches.' },
  { icon: '🎁', title: 'Mystery Crate', text: 'A rare cosmetic crate has been added to your vault.' },
  { icon: '🔥', title: 'On Fire', text: 'Your win streak bonus is boosted by 25% today.' },
  { icon: '⭐', title: 'Lucky Star', text: 'A free ranked ticket has landed in your inbox.' },
  { icon: '🍀', title: 'Four-Leaf Luck', text: 'Next loot roll is guaranteed to be Epic or better.' },
  { icon: '💎', title: 'Diamond Draw', text: 'You earned 3 premium gems. Spend them wisely.' },
  { icon: '🎲', title: 'Roll Again', text: 'Fortune is shy today — come back tomorrow for another spin.' },
];

const FORTUNE_SECTIONS: { id: string; icon: string; title: string; desc: string; open: () => void }[] = [
  {
    id: 'orb',
    icon: '☀️',
    title: 'Cosmic Fortune',
    desc: 'Tap the glowing sun beneath a sky of drifting stars to draw your fate.',
    open: () => openFortuneOrb(),
  },
  {
    id: 'flip',
    icon: '🃏',
    title: 'Fortune Flip',
    desc: 'Flip the mystery cards to reveal the reward hidden on the other side.',
    open: () => openFortuneFlip(),
  },
  {
    id: 'game',
    icon: '🎮',
    title: 'Lucky Game',
    desc: 'Play a quick reflex game and let your skill decide your fortune.',
    open: () => openFortuneGame(),
  },
];

/** "Find Fortune" hub — three sections, each opening its own page. */
export function openFortune(): void {
  cb.setActiveNav('fortune');
  openPage({
    id: 'fortune',
    title: 'FIND FORTUNE',
    subtitle: 'Choose how you want to test your luck',
    html: `
      <div class="fortune-sections">
        ${FORTUNE_SECTIONS.map(
          (s) => `
          <button type="button" class="fortune-section-card" data-id="${esc(s.id)}">
            <span class="fortune-section-icon">${s.icon}</span>
            <span class="fortune-section-title">${esc(s.title)}</span>
            <span class="fortune-section-desc">${esc(s.desc)}</span>
            <span class="fortune-section-go">OPEN ${backIconRight()}</span>
          </button>`,
        ).join('')}
      </div>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.fortune-section-card').forEach((card) => {
        card.addEventListener('click', () => {
          FORTUNE_SECTIONS.find((s) => s.id === card.dataset.id)?.open();
        });
      });
    },
  });
}

const SPARK_COLORS = ['#ffd155', '#ff9e2e', '#ff7b00', '#fff3c4', '#ffb347'];
const WF_COLORS = ['#c084fc', '#a855f7', '#7c3aed', '#f0abfc', '#67e8f9', '#ffd155'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Section 1 — press "Start" to begin a 10s tap frenzy: sparks fly, then the sun shatters into fountains. */
export function openFortuneOrb(): void {
  const dots = Array.from({ length: 46 }, () => {
    const size = 2 + Math.random() * 4;
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const dur = 6 + Math.random() * 10;
    const delay = Math.random() * 10;
    const op = 0.25 + Math.random() * 0.6;
    return `<span class="fx-dot" style="left:${left.toFixed(2)}%;top:${top.toFixed(
      2,
    )}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;animation-duration:${dur.toFixed(
      1,
    )}s;animation-delay:-${delay.toFixed(1)}s;opacity:${op.toFixed(2)}"></span>`;
  }).join('');

  openPage({
    id: 'fortune-orb',
    title: 'COSMIC FORTUNE',
    subtitle: 'Tap the sun and light up the sky',
    html: `
      <div class="fortune-space" id="fortune-space">
        <div class="fx-dots" aria-hidden="true">${dots}</div>
        <div class="fortune-stage">
          <div class="fortune-count" id="fortune-count">10</div>
          <button type="button" class="fortune-sun" id="fortune-sun" aria-label="Start">
            <span class="fortune-sun-face" id="fortune-sun-face">START</span>
          </button>
        </div>
        <p class="fortune-space-result" id="fortune-instruct">Press <b>Start</b> to begin the 10-second challenge!</p>
      </div>
    `,
    onMount(root) {
      const space = root.querySelector<HTMLElement>('#fortune-space');
      const sun = root.querySelector<HTMLButtonElement>('#fortune-sun');
      const face = root.querySelector<HTMLElement>('#fortune-sun-face');
      const count = root.querySelector<HTMLElement>('#fortune-count');
      const instruct = root.querySelector<HTMLElement>('#fortune-instruct');
      if (!space || !sun || !face || !count || !instruct) return;

      let started = false;
      let finished = false;
      let presses = 0;
      let timeLeft = 10;
      let timer = 0;

      const sunCenter = (): { x: number; y: number } => {
        const r = sun.getBoundingClientRect();
        const s = space.getBoundingClientRect();
        return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
      };

      const spawnSparks = (n: number): void => {
        const { x, y } = sunCenter();
        for (let i = 0; i < n; i++) {
          const spark = document.createElement('span');
          spark.className = 'spark';
          const angle = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 150;
          spark.style.left = `${x}px`;
          spark.style.top = `${y}px`;
          spark.style.color = pick(SPARK_COLORS);
          spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          space.appendChild(spark);
          window.setTimeout(() => spark.remove(), 750);
        }
      };

      const shatter = (): void => {
        const { x, y } = sunCenter();
        for (let i = 0; i < 22; i++) {
          const shard = document.createElement('span');
          shard.className = 'sun-shard';
          const angle = Math.random() * Math.PI * 2;
          const dist = 90 + Math.random() * 220;
          shard.style.left = `${x}px`;
          shard.style.top = `${y}px`;
          shard.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          shard.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          shard.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
          space.appendChild(shard);
          window.setTimeout(() => shard.remove(), 950);
        }
        sun.classList.add('shattered');
      };

      const fountain = (xPct: number, yPct: number): void => {
        for (let i = 0; i < 26; i++) {
          const p = document.createElement('span');
          p.className = 'wf-particle';
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
          const speed = 90 + Math.random() * 170;
          p.style.left = `${xPct}%`;
          p.style.top = `${yPct}%`;
          p.style.color = pick(WF_COLORS);
          p.style.setProperty('--dx', `${Math.cos(angle) * speed}px`);
          p.style.setProperty('--dy', `${Math.sin(angle) * speed}px`);
          p.style.animationDelay = `${Math.random() * 0.15}s`;
          space.appendChild(p);
          window.setTimeout(() => p.remove(), 1600);
        }
      };

      const erupt = (): void => {
        const spots = [
          [16, 78],
          [50, 84],
          [84, 78],
          [30, 55],
          [70, 55],
          [50, 40],
        ];
        spots.forEach(([xp, yp], i) => window.setTimeout(() => fountain(xp, yp), i * 200));
      };

      const finish = (): void => {
        finished = true;
        window.clearInterval(timer);
        count.textContent = '0';
        shatter();
        window.setTimeout(erupt, 260);
        instruct.innerHTML = `🎉 Incredible! You tapped <b>${presses}</b> times in 10 seconds!`;
      };

      sun.addEventListener('click', () => {
        if (finished) return;

        if (!started) {
          started = true;
          face.textContent = 'TAP!';
          instruct.textContent = 'Tap the button as fast as you can!';
          count.textContent = '10';
          timer = window.setInterval(() => {
            timeLeft -= 1;
            count.textContent = String(Math.max(0, timeLeft));
            if (timeLeft <= 0) finish();
          }, 1000);
        }

        presses += 1;
        // More presses → more sparks each tap.
        spawnSparks(6 + Math.min(presses, 34));
        sun.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
          { duration: 170, easing: 'ease-out' },
        );
      });
    },
  });
}

/** Section 2 — grid of cards that flip over when clicked. */
export function openFortuneFlip(): void {
  const pool = [...FORTUNES].sort(() => Math.random() - 0.5).slice(0, 6);
  const cards = pool
    .map(
      (f, i) => `
      <button type="button" class="flip-card" data-i="${i}">
        <span class="flip-inner">
          <span class="flip-face flip-front">?</span>
          <span class="flip-face flip-back">
            <span class="flip-icon">${f.icon}</span>
            <span class="flip-title">${esc(f.title)}</span>
            <span class="flip-text">${esc(f.text)}</span>
          </span>
        </span>
      </button>`,
    )
    .join('');

  openPage({
    id: 'fortune-flip',
    title: 'FORTUNE FLIP',
    subtitle: 'Click a card to flip it and reveal your reward',
    html: `<div class="flip-grid">${cards}</div>`,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.flip-card').forEach((card) => {
        card.addEventListener('click', () => {
          const flipped = card.classList.toggle('flipped');
          if (flipped) showToast('Card revealed!');
        });
      });
    },
  });
}

/** Section 3 — a simple reflex mini-game (details to be refined later). */
export function openFortuneGame(): void {
  openPage({
    id: 'fortune-game',
    title: 'LUCKY GAME',
    subtitle: 'Click the targets before the timer runs out',
    html: `
      <div class="page-card mg-card">
        <div class="mg-hud">
          <span class="mg-stat">Score <strong id="mg-score">0</strong></span>
          <span class="mg-stat">Time <strong id="mg-time">15</strong>s</span>
          <button type="button" class="page-btn primary" id="mg-start">START</button>
        </div>
        <div class="mg-area" id="mg-area">
          <p class="mg-hint" id="mg-hint">Press START, then click the glowing targets as fast as you can.</p>
        </div>
      </div>
    `,
    onMount(root) {
      const area = root.querySelector<HTMLElement>('#mg-area');
      const scoreEl = root.querySelector<HTMLElement>('#mg-score');
      const timeEl = root.querySelector<HTMLElement>('#mg-time');
      const hint = root.querySelector<HTMLElement>('#mg-hint');
      const startBtn = root.querySelector<HTMLButtonElement>('#mg-start');
      if (!area || !scoreEl || !timeEl || !startBtn) return;

      let score = 0;
      let time = 15;
      let running = false;
      let tick = 0;
      let target: HTMLButtonElement | null = null;

      const spawn = (): void => {
        target?.remove();
        target = document.createElement('button');
        target.type = 'button';
        target.className = 'mg-target';
        const pad = 12;
        const x = pad + Math.random() * (area.clientWidth - 56 - pad * 2);
        const y = pad + Math.random() * (area.clientHeight - 56 - pad * 2);
        target.style.left = `${Math.max(pad, x)}px`;
        target.style.top = `${Math.max(pad, y)}px`;
        target.addEventListener('click', () => {
          if (!running) return;
          score += 1;
          scoreEl.textContent = String(score);
          spawn();
        });
        area.appendChild(target);
      };

      const end = (): void => {
        running = false;
        window.clearInterval(tick);
        target?.remove();
        target = null;
        startBtn.disabled = false;
        startBtn.textContent = 'PLAY AGAIN';
        if (hint) {
          hint.textContent = `Time's up! You scored ${score}.`;
          area.appendChild(hint);
        }
        showToast(`Final score: ${score}`);
      };

      const start = (): void => {
        score = 0;
        time = 15;
        running = true;
        scoreEl.textContent = '0';
        timeEl.textContent = '15';
        startBtn.disabled = true;
        startBtn.textContent = 'PLAYING…';
        hint?.remove();
        spawn();
        window.clearInterval(tick);
        tick = window.setInterval(() => {
          time -= 1;
          timeEl.textContent = String(Math.max(0, time));
          if (time <= 0) end();
        }, 1000);
      };

      startBtn.addEventListener('click', start);
    },
  });
}

function triggerDownload(fileName: string, os: string): void {
  const readme = [
    'LINK — Draw your links. Control the battle.',
    '',
    `Platform: ${os}`,
    `Installer: ${fileName}`,
    'Version: 0.1.0',
    '',
    'Thanks for downloading LINK! This is a prototype build.',
    'Run the installer and sign in with your LINK account to start at Rank #1.',
  ].join('\n');
  const blob = new Blob([readme], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function openGeneric(title: string, bodyText: string, id = 'info'): void {
  openPage({
    id,
    title,
    html: `<div class="page-card"><p class="page-text">${esc(bodyText)}</p></div>`,
  });
}

function backIcon(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
}

function backIconRight(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
}

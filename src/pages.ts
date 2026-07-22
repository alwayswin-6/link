import { getAuthUser } from './auth';
import { showToast } from './ui';

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
}

let cb: RouterCallbacks;
let mainEl: HTMLElement;
let homeEl: HTMLElement;
let pageEl: HTMLElement;
const stack: PageDescriptor[] = [];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

  window.addEventListener('popstate', (e) => {
    const depth = (e.state && typeof e.state.linkDepth === 'number' ? e.state.linkDepth : 0) as number;
    syncToDepth(depth);
  });
}

function syncToDepth(depth: number): void {
  if (depth <= 0) {
    stack.length = 0;
    renderHome();
    return;
  }
  stack.length = Math.min(stack.length, depth);
  const top = stack[stack.length - 1];
  if (top) renderPage(top);
  else renderHome();
}

function renderHome(): void {
  pageEl.hidden = true;
  pageEl.innerHTML = '';
  homeEl.hidden = false;
  document.querySelector('#dashboard')?.classList.remove('is-chat');
  mainEl.classList.remove('is-chat');
  window.scrollTo({ top: 0 });
  document.querySelector('#dashboard')?.scrollTo?.({ top: 0 });
}

function renderPage(page: PageDescriptor): void {
  // Leave chat/home, show the page container
  document.querySelector('#dashboard')?.classList.remove('is-chat');
  mainEl.classList.remove('is-chat');
  homeEl.hidden = true;
  pageEl.hidden = false;
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
  history.pushState({ linkDepth: stack.length }, '', `#/${page.id}`);
  renderPage(page);
}

export function goHome(): void {
  stack.length = 0;
  history.pushState({ linkDepth: 0 }, '', '#/');
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
  const top = stack[stack.length - 1];
  history.pushState({ linkDepth: stack.length }, '', `#/${top.id}`);
  renderPage(top);
}

/* ————————————————————————————— Static pages ————————————————————————————— */

export function openProfile(): void {
  const user = getAuthUser();
  const name = (user?.username ?? 'Guest').toUpperCase();
  const rank = user?.rank ?? 1;
  const rating = user?.rating ?? 0;
  openPage({
    id: 'profile',
    title: 'PLAYER PROFILE',
    subtitle: user ? esc(user.email) : 'Guest session',
    html: `
      <div class="page-card page-profile">
        <div class="page-profile-top">
          <div class="page-avatar"><img src="/position/user1.png" alt="" /></div>
          <div>
            <h2 class="page-profile-name">${esc(name)}</h2>
            <p class="page-badge">◆ RANK #${rank} · Season 1</p>
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

export function openShop(): void {
  const packs = [
    ['Starter Pack', '500 ₡', '$4.99'],
    ['Value Bundle', '1,200 ₡', '$9.99'],
    ['Pro Bundle', '2,500 ₡', '$19.99'],
    ['Elite Vault', '6,500 ₡', '$49.99'],
  ];
  openPage({
    id: 'shop',
    title: 'STORE',
    subtitle: 'Credits, skins & battle passes',
    html: `
      <div class="page-grid cols-2">
        ${packs
          .map(
            ([n, c, p]) => `
          <div class="page-card shop-card">
            <div class="shop-coin">₡</div>
            <h3>${n}</h3>
            <div class="shop-amount">${c}</div>
            <button type="button" class="page-btn primary shop-buy" data-pack="${esc(n)}">${p}</button>
          </div>`,
          )
          .join('')}
      </div>
      <p class="page-text">Purchases are simulated in this prototype build.</p>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.shop-buy').forEach((b) =>
        b.addEventListener('click', () => showToast(`Purchased ${b.dataset.pack} (demo) — credits added`)),
      );
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

export function openRanking(): void {
  cb.setActiveNav('ranking');
  openPage({
    id: 'ranking',
    title: 'LEADERBOARD',
    subtitle: 'Season 1 · global standings',
    html: `
      <div class="page-table">
        <div class="page-tr head">
          <span>#</span><span>Player</span><span>League</span><span>Rating</span><span>Win %</span><span>Streak</span>
        </div>
        ${LEADERS.map(
          ([n, lg, r, w, s], i) => `
          <button type="button" class="page-tr lb-row" data-idx="${i}">
            <span class="lb-pos">${i + 1}</span>
            <span class="lb-player"><img src="/position/image${(i % 4) + 1}.png" alt="" />${n}</span>
            <span>${lg}</span>
            <span>${r}</span>
            <span>${w}</span>
            <span>🔥 ${s}</span>
          </button>`,
        ).join('')}
      </div>
    `,
    onMount(root) {
      root.querySelectorAll<HTMLButtonElement>('.lb-row').forEach((row) =>
        row.addEventListener('click', () => openPlayer(Number(row.dataset.idx))),
      );
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

export function openCommunity(): void {
  openPage({
    id: 'community',
    title: 'COMMUNITY',
    subtitle: 'Connect with players worldwide',
    html: `
      <div class="page-hero-banner">
        <img src="/position/JOIN%20OUR%20COMMUNITY.png" alt="" />
        <div class="page-hero-overlay"></div>
        <div class="page-hero-text"><h2>JOIN OUR COMMUNITY</h2><p>Compete, share, and connect.</p></div>
      </div>
      <div class="page-card">
        <ul class="page-list">
          <li>Weekly tournaments and scrims</li>
          <li>Clip contests and creator programs</li>
          <li>Direct feedback to the LINK team</li>
        </ul>
        <div class="page-actions">
          <button type="button" class="page-btn primary" id="cm-discord">JOIN DISCORD</button>
          <button type="button" class="page-btn" id="cm-news">READ NEWS</button>
        </div>
      </div>
    `,
    onMount(root) {
      root.querySelector('#cm-discord')?.addEventListener('click', () => {
        window.open('https://discord.com/', '_blank', 'noopener,noreferrer');
        showToast('Opening Discord…');
      });
    },
  });
}

const OTHER_PLATFORMS: { os: string; file: string }[] = [
  { os: 'macOS', file: 'LINK-Installer-macOS.dmg' },
  { os: 'Android', file: 'LINK-Android.apk' },
  { os: 'iOS', file: 'LINK-iOS.ipa' },
];

const WINDOWS_FILE = 'LINK-Setup-Windows.exe';

function downloadGlyph(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
}

/** LINK is an app game — PLAY opens this download page with a centered Windows button. */
export function openDownload(): void {
  openPage({
    id: 'download',
    title: 'DOWNLOAD LINK',
    subtitle: 'Get the LINK app game for your device',
    html: `
      <div class="page-card dl-page">
        <div class="dl-logo">LINK</div>
        <p class="page-text dl-lead">LINK is a downloadable app game. Click the button below to download the Windows installer and start playing.</p>
        <button type="button" class="dl-main-btn" data-os="Windows" data-file="${esc(WINDOWS_FILE)}">
          <span class="dl-main-icon">${downloadGlyph()}</span>
          <span class="dl-main-label">DOWNLOAD FOR WINDOWS</span>
        </button>
        <p class="dl-meta">Version 0.1.0 · ~120 MB · Windows 10/11 · 64-bit</p>
        <div class="dl-others">
          <span class="dl-others-label">Other platforms</span>
          <div class="dl-others-row">
            ${OTHER_PLATFORMS.map(
              (p) =>
                `<button type="button" class="dl-other-btn" data-os="${esc(p.os)}" data-file="${esc(p.file)}">${esc(p.os)}</button>`,
            ).join('')}
          </div>
        </div>
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

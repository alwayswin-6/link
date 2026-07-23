import { chatRoomHTML } from './chat';

/** Green placeholders in /public/position — replace by renaming your real art to these filenames. */
const IMG = {
  hero: '/position/game-hero-placeholder.png',
  cover1: '/position/game-cover-1.png',
  cover2: '/position/game-cover-2.png',
  modeQuick: '/position/game-mode-quick.png',
  modeRanked: '/position/game-mode-ranked.png',
  modeCustom: '/position/game-mode-custom.png',
  modeTraining: '/position/game-mode-training.png',
  news1: '/position/game-news-1.png',
  news2: '/position/game-news-2.png',
  news3: '/position/game-news-3.png',
  event: '/position/game-event-placeholder.png',
  community: '/position/game-community-placeholder.png',
} as const;

export function dashboardHTML(): string {
  return `
  <div id="dashboard" class="dash">
    <header class="dash-header">
      <div class="dash-header-inner">
        <a class="dash-brand" href="#/" data-nav="home" aria-label="LINK">
          ${brandLogoSvg()}
          <span class="dash-brand-title">LINK</span>
        </a>

        <nav class="dash-nav" aria-label="Main">
          <a class="dash-nav-item active" href="#/" data-nav="home"><span>Dashboard</span></a>
          <a class="dash-nav-item" href="#download" data-nav="download" id="nav-play"><span>Download</span></a>
          <a class="dash-nav-item" href="#leaderboard" data-nav="ranking" id="nav-ranking"><span>Rankings</span></a>
          <a class="dash-nav-item" href="#matches" data-nav="matches" id="nav-matches"><span>Matches</span></a>
          <a class="dash-nav-item" href="#community" data-nav="community" id="nav-community"><span>Community</span></a>
          <a class="dash-nav-item" href="#inventory" data-nav="inventory" id="nav-inventory"><span>Inventory</span></a>
          <a class="dash-nav-item" href="#shop" data-nav="shop" id="nav-shop"><span>Shop</span></a>
          <a class="dash-nav-item" href="#settings" data-nav="settings" id="nav-settings"><span>Settings</span></a>
        </nav>

        <div class="dash-topbar-right">
          <label class="dash-search" aria-label="Search">
            <span class="dash-search-ico" aria-hidden="true">${iconSearch()}</span>
            <input type="search" placeholder="Search games, players…" id="dash-search" />
          </label>
          <button type="button" class="dash-icon-btn dash-theme-toggle" id="theme-toggle" aria-label="Toggle light and dark theme" title="Toggle theme">${iconTheme()}</button>
          <button type="button" class="dash-icon-btn has-dot" id="topbar-chat" aria-label="Open chat" title="Chat">${iconChat()}</button>
          <button type="button" class="dash-icon-btn has-dot" aria-label="Notifications">${iconBell()}</button>
          <button type="button" class="dash-user-chip" id="auth-user-chip" hidden>
            <span class="dash-user-avatar"><img class="dash-fill" src="/position/user2.png" alt="Player avatar" /></span>
            <span class="dash-user-meta">
              <span class="dash-online-dot" title="Online" aria-label="Online"></span>
              <span class="dash-user-name">Player</span>
            </span>
            <span class="dash-chevron" aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
    </header>

    <div class="dash-main">
      ${chatRoomHTML()}

      <div class="dash-scroll" id="dash-home">
          <!-- HERO — full-bleed, image clipped above diagonal -->
          <section class="dash-hero">
            <div class="dash-hero-bg" aria-hidden="true">
              <div class="dash-hero-slides" id="hero-slides">
                <img class="dash-hero-slide active" src="${IMG.hero}" alt="" data-index="0" loading="eager" decoding="async" />
                <img class="dash-hero-slide" src="${IMG.cover1}" alt="" data-index="1" loading="lazy" decoding="async" />
                <img class="dash-hero-slide" src="${IMG.cover2}" alt="" data-index="2" loading="lazy" decoding="async" />
                <img class="dash-hero-slide" src="${IMG.event}" alt="" data-index="3" loading="lazy" decoding="async" />
              </div>
              <div class="dash-hero-veil"></div>
            </div>
            <svg class="dash-hero-slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="75" x2="100" y2="80" />
            </svg>
            <div class="dash-hero-body">
              <div class="dash-hero-copy">
                <p class="dash-hero-eyebrow">Featured game</p>
                <h1 class="dash-hero-title">LINK</h1>
                <p class="dash-hero-sub">
                  Capture energy nodes, draw the battlefield, and climb ranked. Download and play.
                </p>
                <div class="dash-hero-actions">
                  <button type="button" class="dash-btn-play" id="play-now-btn">
                    <span class="dash-download-icon">${iconDownload()}</span>
                    Download
                  </button>
                  <button type="button" class="dash-btn-how" id="quick-play-btn">
                    <span class="dash-play-ico">${iconPlay()}</span>
                    Play now
                  </button>
                </div>
                <div class="dash-hero-meta">
                  <span class="dash-hero-chip"><span class="live-dot"></span> 24,582 online</span>
                  <span class="dash-hero-chip">Patch 0.1.0</span>
                </div>
              </div>
              <div class="dash-hero-dots" id="hero-dots">
                <button type="button" class="active" data-index="0" aria-label="Slide 1"></button>
                <button type="button" data-index="1" aria-label="Slide 2"></button>
                <button type="button" data-index="2" aria-label="Slide 3"></button>
                <button type="button" data-index="3" aria-label="Slide 4"></button>
              </div>
            </div>
          </section>

        <div class="dash-content">
          <!-- GAME MODES -->
          <section class="dash-section">
            <div class="dash-section-head">
              <div>
                <h2 class="dash-section-title">Modes</h2>
                <p class="dash-section-desc">Pick how you want to play today.</p>
              </div>
            </div>
            <div class="dash-modes">
              ${modeCard({
                color: 'cyan',
                image: IMG.modeQuick,
                icon: iconModeQuick(),
                title: 'Quick Match',
                desc: 'Jump into a fast online match.',
                meta: '2–8 players · ~15s queue',
                button: 'Download',
                status: 'Live',
                buttonId: 'mode-quick',
              })}
              ${modeCard({
                color: 'violet',
                image: IMG.modeRanked,
                icon: iconModeRanked(),
                title: 'Ranked',
                desc: 'Climb the seasonal leaderboard.',
                meta: 'Season 1 · Skill rating',
                button: 'Start ranked',
                badge: 'Competitive',
                featured: true,
                buttonId: 'mode-ranked',
              })}
              ${modeCard({
                color: 'blue',
                image: IMG.modeCustom,
                icon: iconModeCustom(),
                title: 'Custom',
                desc: 'Private rooms with friends.',
                meta: 'Invite · Custom rules',
                button: 'Create lobby',
                status: 'Open',
                buttonId: 'mode-custom',
              })}
              ${modeCard({
                color: 'teal',
                image: IMG.modeTraining,
                icon: iconModeTraining(),
                title: 'Training',
                desc: 'Practice vs AI bots.',
                meta: 'Tutorials · Free play',
                button: 'Start training',
                status: 'Ready',
                buttonId: 'mode-training',
              })}
            </div>
          </section>

          <!-- RANKINGS -->
          <section class="dash-section" id="section-ranking">
            <div class="dash-section-head">
              <div>
                <h2 class="dash-section-title">Top players</h2>
                <p class="dash-section-desc">Season 1 standings.</p>
              </div>
              <a class="dash-view-all gold lb-viewall" href="#">Full leaderboard ${iconArrowRight()}</a>
            </div>
            <div class="dash-leaderboard">
              ${leaderCard({ rank: 1, name: 'ShadowLink', league: 'Champion', rating: '3,450', winRate: '82%', streak: '9', matches: '285', progress: 84, next: 'Grandmaster', clan: 'LNK' })}
              ${leaderCard({ rank: 2, name: 'NeonX', league: 'Master', rating: '3,210', winRate: '78%', streak: '7', matches: '268', progress: 76, next: 'Champion', clan: 'VYU' })}
              ${leaderCard({ rank: 3, name: 'CyberNull', league: 'Diamond', rating: '2,980', winRate: '74%', streak: '5', matches: '249', progress: 68, next: 'Master', clan: 'NUL' })}
              ${leaderCard({ rank: 4, name: 'PulseFire', league: 'Elite', rating: '2,750', winRate: '70%', streak: '4', matches: '231', progress: 60, next: 'Diamond', clan: 'FIR' })}
              ${leaderCard({ rank: 5, name: 'LinkMaster', league: 'Legend', rating: '2,540', winRate: '66%', streak: '3', matches: '210', progress: 52, next: 'Elite', clan: 'LMX' })}
            </div>
          </section>

          <!-- TEAM RANKINGS -->
          <section class="dash-section">
            <div class="dash-section-head">
              <div>
                <h2 class="dash-section-title">Teams</h2>
                <p class="dash-section-desc">Clan standings this season.</p>
              </div>
              <button type="button" class="dash-btn-join" id="join-team-btn">Join Team</button>
            </div>
            <div class="dash-team-table glass-panel">
              <div class="team-row head">
                <span>#</span>
                <span>Team</span>
                <span>Members</span>
                <span>Wins</span>
                <span>Rating</span>
                <span></span>
              </div>
              ${teamRow(1, 'Neon Circuit', 'NC', 48, 312, '4,820', true)}
              ${teamRow(2, 'Void Walkers', 'VW', 36, 278, '4,510')}
              ${teamRow(3, 'Pulse Syndicate', 'PS', 52, 265, '4,290')}
              ${teamRow(4, 'Apex Grid', 'AG', 29, 241, '3,980')}
              ${teamRow(5, 'Link Legion', 'LL', 41, 220, '3,740')}
            </div>
          </section>

          <!-- NEWS -->
          <section class="dash-section">
            <div class="dash-section-head">
              <div>
                <h2 class="dash-section-title">News</h2>
                <p class="dash-section-desc">Patches and game updates.</p>
              </div>
              <a class="dash-view-all" href="#">View all ${iconArrowRight()}</a>
            </div>
            <div class="dash-news">
              ${newsCard('update', 'Update', 'Patch 0.1.0', 'Balance changes, fixes, and QoL improvements.', 'May 20, 2024', IMG.news1)}
              ${newsCard('news', 'News', 'Season 1 live', 'Ranked ladder, missions, and events are open.', 'May 18, 2024', IMG.news2)}
              ${newsCard('tips', 'Tips', 'New to LINK?', 'Learn capture, links, and Energy Zones.', 'May 16, 2024', IMG.news3)}
            </div>
          </section>

          <!-- EVENT -->
          <section class="dash-section">
            <div class="dash-section-head">
              <div>
                <h2 class="dash-section-title">Event</h2>
                <p class="dash-section-desc">Limited-time rewards.</p>
              </div>
              <a class="dash-view-all" href="#">Details ${iconArrowRight()}</a>
            </div>
            <div class="dash-event glass-panel">
              <img class="evt-bg" src="${IMG.event}" alt="" aria-hidden="true" />
              <div class="evt-overlay" aria-hidden="true"></div>
              <div class="evt-content">
                <div class="evt-left">
                  <div class="evt-label">Limited time</div>
                  <h3 class="evt-title">Neon Storm</h3>
                  <p class="evt-desc">Play event missions and unlock exclusive rewards.</p>
                  <div class="evt-countdown">${iconClock()}<span>Ends in 6d 12h 45m</span></div>
                  <button type="button" class="evt-view-btn">View event ${iconArrowRight()}</button>
                </div>
              </div>
            </div>
          </section>

          <!-- COMMUNITY -->
          <section class="dash-community">
            <img class="dash-community-bg" src="${IMG.community}" alt="" aria-hidden="true" />
            <div class="dash-community-overlay" aria-hidden="true"></div>
            <div class="dash-community-content">
              <h2>Community</h2>
              <p>Find teammates, share clips, and follow season news.</p>
              <div class="dash-community-actions">
                <button type="button" class="dash-btn-discord">${iconDiscord()} Discord</button>
                <button type="button" class="dash-btn-learn">Learn more ${iconArrowRight()}</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
  `;
}

export function gameViewHTML(): string {
  return `
  <div id="game-view" class="game-view" hidden>
    <button type="button" class="game-back" id="back-to-dash">← Dashboard</button>
    <div class="shell">
      <div class="brand">LINK</div>
      <div class="tagline">Capture energy · Draw the battlefield</div>
      <div class="stage-wrap">
        <canvas id="game" width="960" height="540"></canvas>
        <div class="hud">
          <div class="hud-top">
            <div class="timer" id="timer">3:00</div>
            <div class="scores" id="scores"></div>
          </div>
          <div class="hint">
            Attacks leave glowing links for 5s. Your links speed you up; enemy links slow you.
            Connect three into a triangle to form an Energy Zone.
          </div>
        </div>
        <div class="overlay" id="overlay">
          <div class="overlay-card">
            <h2 id="overlay-title">LINK</h2>
            <p id="overlay-body">
              Capture energy nodes. Shape the arena with attack links.
              Highest energy when time runs out wins.
            </p>
            <button type="button" id="start-btn">Start match</button>
          </div>
        </div>
      </div>
      <div class="controls-bar">
        <span><kbd>A</kbd>/<kbd>D</kbd> or ←/→ Move</span>
        <span><kbd>W</kbd>/<kbd>Space</kbd>/↑ Jump</span>
        <span><kbd>J</kbd>/<kbd>Z</kbd> Attack</span>
        <span><kbd>K</kbd>/<kbd>X</kbd> Dash</span>
      </div>
    </div>
  </div>
  `;
}

function teamRow(
  rank: number,
  name: string,
  tag: string,
  members: number,
  wins: number,
  rating: string,
  top = false
): string {
  return `
    <div class="team-row${top ? ' top' : ''}">
      <span class="team-rank">#${rank}</span>
      <span class="team-identity">
        <span class="team-crest">${tag.slice(0, 2)}</span>
        <span class="team-name">${name}</span>
        <span class="team-tag">[${tag}]</span>
      </span>
      <span class="team-stat">${members}</span>
      <span class="team-stat">${wins}</span>
      <span class="team-rating">${rating}</span>
      <span class="team-action"><button type="button" class="team-view-btn">View</button></span>
    </div>
  `;
}

function newsCard(
  tag: string,
  label: string,
  title: string,
  desc: string,
  date: string,
  img: string
): string {
  return `
    <article class="dash-news-card glass-card">
      <div class="dash-news-thumb">
        <img src="${img}" alt="${title}" />
        <span class="dash-news-shade" aria-hidden="true"></span>
        <span class="dash-news-badge ${tag}">${label}</span>
        <span class="lib-ph-label sm">REPLACE IMAGE</span>
      </div>
      <div class="dash-news-body">
        <h4>${title}</h4>
        <p class="dash-news-desc">${desc}</p>
        <div class="dash-news-foot">
          <span class="dash-news-date">${iconCalendar()} ${date}</span>
          <span class="dash-news-more">Read ${iconArrowRight()}</span>
        </div>
      </div>
    </article>
  `;
}

function iconModeQuick() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>`;
}
function iconModeRanked() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v4a6 6 0 0 1-12 0V4Z"/><path d="M6 6H3.5v1.5A3.5 3.5 0 0 0 6.4 11M18 6h2.5v1.5A3.5 3.5 0 0 1 17.6 11"/><path d="M12 14v3.5M8.5 21h7M9.5 21a2.5 2.5 0 0 1 5 0"/></svg>`;
}
function iconModeCustom() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6.5" y1="12" x2="10.5" y2="12"/><line x1="8.5" y1="10" x2="8.5" y2="14"/><line x1="15.5" y1="11" x2="15.51" y2="11"/><line x1="18" y1="13" x2="18.01" y2="13"/></svg>`;
}
function iconModeTraining() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`;
}

interface ModeData {
  color: string;
  image: string;
  icon: string;
  title: string;
  desc: string;
  meta: string;
  button: string;
  badge?: string;
  status?: string;
  featured?: boolean;
  buttonId?: string;
}

function modeCard(m: ModeData): string {
  const statusText = m.status ?? m.badge;
  const statusEl = statusText
    ? `<span class="gm-status"><span class="gm-status-dot"></span>${statusText}</span>`
    : '';
  const idAttr = m.buttonId ? ` id="${m.buttonId}"` : '';
  return `
    <div class="gm-card glass-card ${m.color}${m.featured ? ' featured' : ''}">
      <div class="gm-art">
        <img src="${m.image}" alt="" />
        <span class="lib-ph-label sm">REPLACE IMAGE</span>
        ${statusEl}
      </div>
      <div class="gm-body">
        <div class="gm-icon">${m.icon}</div>
        <h3 class="gm-title">${m.title}</h3>
        <p class="gm-desc">${m.desc}</p>
        <p class="gm-meta">${m.meta}</p>
        <button type="button" class="gm-btn"${idAttr}>${m.button}</button>
      </div>
    </div>
  `;
}

interface LeaderData {
  rank: number;
  name: string;
  league: string;
  rating: string;
  winRate: string;
  streak: string;
  matches: string;
  progress: number;
  next: string;
  clan: string;
}

function leaderCard(p: LeaderData): string {
  const tier =
    p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : 'standard';
  return `
    <button type="button" class="lb-card glass-card ${tier}" aria-label="${p.name} — rank ${p.rank}">
      <span class="lb-rank">#${p.rank}</span>
      <span class="lb-avatar-wrap">
        <span class="lb-avatar">
          <img src="/position/image${((p.rank - 1) % 4) + 1}.png" alt="${p.name}" />
          <span class="lb-online" title="Online"></span>
        </span>
      </span>
      <span class="lb-name">${p.name}</span>
      <span class="lb-league">${p.league}</span>
      <span class="lb-meta">
        <span class="lb-clan">[${p.clan}]</span>
        <span class="lb-season">S1</span>
      </span>
      <span class="lb-stats">
        <span class="lb-stat"><span class="lb-stat-label">Rating</span><span class="lb-stat-value">${p.rating}</span></span>
        <span class="lb-stat"><span class="lb-stat-label">Win %</span><span class="lb-stat-value">${p.winRate}</span></span>
      </span>
    </button>
  `;
}

function brandLogoSvg(): string {
  return `
    <svg class="dash-brand-mark" viewBox="0 0 32 32" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="linkMarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#22D3EE"/>
          <stop offset="55%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#8B5CF6"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#linkMarkGrad)" opacity="0.18"/>
      <path d="M8 16h6l2-6 4 12 2-6h4" fill="none" stroke="url(#linkMarkGrad)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function iconPlay() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`;
}
function iconChat() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/></svg>`;
}
function iconTheme() {
  return `<svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}
function iconBell() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`;
}
function iconSearch() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
}
function iconDiscord() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 5.5A16 16 0 0 0 15.5 4l-.7 1.3a14 14 0 0 0-5.6 0L8.5 4A16 16 0 0 0 4 5.5C2 8.7 1.4 11.8 1.6 14.9A16 16 0 0 0 6.5 17l1-1.3a10 10 0 0 1-1.5-.7l.4-.3a11 11 0 0 0 11.2 0l.4.3c-.5.3-1 .5-1.5.7l1 1.3a16 16 0 0 0 4.9-2.1c.4-3.5-.6-6.6-2.4-9.4zM8.7 13.2c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.7 1.6-1.5 1.6zm6.6 0c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.7 1.6-1.5 1.6z"/></svg>`;
}
function iconClock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
}
function iconArrowRight() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
}
function iconDownload() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
}
function iconCalendar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`;
}

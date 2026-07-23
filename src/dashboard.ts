import { chatRoomHTML } from './chat';

/** Green placeholders in /public/position — replace by renaming your real art to these filenames. */
const IMG = {
  hero: '/position/game-hero-placeholder.png',
  general1: '/position/game-general-1.png',
  general2: '/position/game-general-2.png',
  general3: '/position/game-general-3.png',
  general4: '/position/game-general-4.png',
  banner1: '/position/game-banner-wide-1.png',
  banner2: '/position/game-banner-wide-2.png',
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
        <!-- HERO — full-bleed, single image, diagonal clip -->
        <section class="dash-hero">
          <div class="dash-hero-bg" aria-hidden="true">
            <img class="dash-hero-img" src="${IMG.hero}" alt="" loading="eager" decoding="async" />
            <div class="dash-hero-veil"></div>
          </div>
          <svg class="dash-hero-slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="78" x2="100" y2="84" />
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
          </div>
        </section>

        <div class="dash-content">
          <!-- GENERALS -->
          <section class="dash-section dash-generals">
            <div class="dash-generals-grid">
              ${generalCard(IMG.general1, 'Pulse', 'Assault', 'Fast captures and aggressive links.')}
              ${generalCard(IMG.general2, 'Void', 'Control', 'Zone denial and battlefield pressure.')}
              ${generalCard(IMG.general3, 'Neon', 'Support', 'Boost allies and extend energy lines.')}
              ${generalCard(IMG.general4, 'Apex', 'Tactical', 'Precision plays and ranked climbs.')}
            </div>
          </section>

          <!-- WIDE IMAGE 1 (was Top Players) -->
          <section class="dash-section dash-wide">
            <figure class="dash-wide-frame">
              <img src="${IMG.banner1}" alt="" loading="lazy" decoding="async" />
              <span class="lib-ph-label">REPLACE IMAGE</span>
            </figure>
          </section>

          <!-- ABOUT (was Teams) -->
          <section class="dash-section dash-about">
            <div class="dash-about-panel glass-panel">
              <p class="dash-about-eyebrow">About LINK</p>
              <h2 class="dash-about-title">A competitive arena built around energy, movement, and connection.</h2>
              <p class="dash-about-text">
                LINK is a fast multiplayer battle game where every attack draws a glowing link across the map.
                Capture nodes to gather energy, turn enemy ground into your path, and form Energy Zones by connecting three links into a triangle.
                Climb the ranked ladder, complete missions, and compete with players worldwide.
              </p>
              <p class="dash-about-text">
                Whether you queue for a quick match or push for Champion, the battlefield rewards clear decisions and sharp timing.
              </p>
            </div>
          </section>

          <!-- WIDE IMAGE 2 (was News) -->
          <section class="dash-section dash-wide">
            <figure class="dash-wide-frame">
              <img src="${IMG.banner2}" alt="" loading="lazy" decoding="async" />
              <span class="lib-ph-label">REPLACE IMAGE</span>
            </figure>
          </section>

          <!-- DOWNLOAD (was Event) -->
          <section class="dash-section dash-download-block">
            <div class="dash-download-panel glass-panel">
              <p class="dash-download-eyebrow">Get the game</p>
              <h2 class="dash-download-title">Download for Windows</h2>
              <p class="dash-download-text">
                Install LINK on your PC and jump into ranked, custom lobbies, and training.
              </p>
              <button type="button" class="dash-btn-play" id="windows-download-btn">
                <span class="dash-download-icon">${iconDownload()}</span>
                Download for Windows
              </button>
              <p class="dash-download-soon">
                Coming soon on other devices — macOS, Android, and iOS releases are on the way.
              </p>
            </div>
          </section>

          <!-- COMMUNITY -->
          <section class="dash-section dash-community-block">
            <div class="dash-community glass-panel">
              <img class="dash-community-bg" src="${IMG.community}" alt="" aria-hidden="true" />
              <div class="dash-community-overlay" aria-hidden="true"></div>
              <div class="dash-community-content">
                <p class="dash-community-eyebrow">Players</p>
                <h2>Join the community</h2>
                <p>Find teammates, share clips, and stay updated on seasons and events.</p>
                <div class="dash-community-actions">
                  <button type="button" class="dash-btn-discord">${iconDiscord()} Discord</button>
                  <button type="button" class="dash-btn-learn">Learn more ${iconArrowRight()}</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer class="dash-footer">
          <div class="dash-footer-inner">
            <div class="dash-footer-brand">
              ${brandLogoSvg()}
              <span>LINK</span>
            </div>
            <nav class="dash-footer-nav" aria-label="Footer">
              <a href="#download" data-nav="download">Download</a>
              <a href="#leaderboard" data-nav="ranking">Rankings</a>
              <a href="#community" data-nav="community">Community</a>
              <a href="#shop" data-nav="shop">Shop</a>
              <a href="#settings" data-nav="settings">Settings</a>
            </nav>
            <p class="dash-footer-copy">© ${new Date().getFullYear()} LINK. All rights reserved. · v0.1.0</p>
          </div>
        </footer>
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

function generalCard(img: string, name: string, role: string, desc: string): string {
  return `
    <article class="general-card glass-card">
      <div class="general-art">
        <img src="${img}" alt="${name}" />
        <span class="lib-ph-label sm">REPLACE IMAGE</span>
      </div>
      <div class="general-body">
        <p class="general-role">${role}</p>
        <h3 class="general-name">${name}</h3>
        <p class="general-desc">${desc}</p>
      </div>
    </article>
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
function iconArrowRight() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
}
function iconDownload() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
}

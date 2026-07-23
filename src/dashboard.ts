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
        <a class="dash-brand" href="/" data-nav="home" aria-label="LINK">
          ${brandLogo()}
          <span class="dash-brand-title focus-text">LIN<span class="focus-accent">K</span></span>
        </a>

        <nav class="dash-nav" aria-label="Main">
          <a class="dash-nav-item active" href="/" data-nav="home"><span>Dashboard</span></a>
          <a class="dash-nav-item" href="/download" data-nav="download" id="nav-play"><span>Download</span></a>
          <a class="dash-nav-item" href="/leaderboard" data-nav="ranking" id="nav-ranking"><span>Rankings</span></a>
          <a class="dash-nav-item" href="/matches" data-nav="matches" id="nav-matches"><span>Matches</span></a>
          <a class="dash-nav-item" href="/community" data-nav="community" id="nav-community"><span>Community</span></a>
          <a class="dash-nav-item" href="/inventory" data-nav="inventory" id="nav-inventory"><span>Inventory</span></a>
          <a class="dash-nav-item" href="/shop" data-nav="shop" id="nav-shop"><span>Shop</span></a>
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
            <span class="dash-user-avatar cos-avatar-shell sm" id="dash-user-cos">
              <span class="cos-avatar-core"><img class="dash-fill" src="/position/defult.png" alt="Player avatar" /></span>
            </span>
            <span class="dash-user-meta">
              <span class="dash-online-dot" title="Online" aria-label="Online"></span>
              <span class="dash-user-name" id="dash-user-nameplate">Player</span>
            </span>
            <span class="dash-chevron" aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
    </header>

    <div class="dash-main">
      ${chatRoomHTML()}

      <div class="dash-scroll" id="dash-home">
        <!-- HERO -->
        <section class="dash-hero">
          <div class="dash-hero-bg" aria-hidden="true">
            <img class="dash-hero-img" src="${IMG.hero}" alt="" loading="eager" decoding="async" />
            <div class="dash-hero-veil"></div>
          </div>
          <svg class="dash-hero-slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="88" x2="100" y2="94" />
          </svg>
          <div class="dash-hero-body">
            <div class="dash-hero-copy">
              <p class="dash-hero-eyebrow">Season 01 · Competitive PC Arena</p>
              <h1 class="dash-hero-title focus-text">Draw the <span class="focus-accent">battlefield</span></h1>
              <p class="dash-hero-sub">
                Capture energy nodes, connect glowing links, and climb ranked.
                A fast multiplayer arena built for decisive plays.
              </p>
              <div class="dash-hero-actions">
                <button type="button" class="dash-btn-play" id="play-now-btn">
                  <span class="dash-download-icon">${iconDownload()}</span>
                  Download for Windows
                </button>
                <button type="button" class="dash-btn-how" id="quick-play-btn">
                  View Trailer
                </button>
              </div>
              <div class="dash-hero-meta">
                <span class="dash-hero-chip"><span class="live-dot"></span> 24,582 online</span>
                <span class="dash-hero-chip">Free to play</span>
                <span class="dash-hero-chip">Patch 0.1.0</span>
              </div>
            </div>
          </div>
        </section>

        <div class="dash-content dash-content--pad">
          <!-- FEATURES / GENERALS -->
          <section class="dash-section dash-generals">
            <div class="dash-section-head">
              <div>
                <p class="dash-section-eyebrow">Loadouts</p>
                <h2 class="dash-section-title focus-text">Choose your <span class="focus-accent">general</span></h2>
                <p class="dash-section-desc">Four roles. One objective. Master the link that fits your playstyle.</p>
              </div>
            </div>
            <div class="dash-generals-grid">
              ${generalCard(IMG.general1, 'Pulse', 'Assault', 'Fast captures and aggressive links.')}
              ${generalCard(IMG.general2, 'Void', 'Control', 'Zone denial and battlefield pressure.')}
              ${generalCard(IMG.general3, 'Neon', 'Support', 'Boost allies and extend energy lines.')}
              ${generalCard(IMG.general4, 'Apex', 'Tactical', 'Precision plays and ranked climbs.')}
            </div>
          </section>
        </div>

        <!-- TOURNAMENT / EVENT BANNER -->
        <section class="dash-promo-bleed">
          <div class="dash-promo">
            <img class="dash-promo-bg" src="${IMG.banner1}" alt="" loading="lazy" decoding="async" />
            <div class="dash-promo-veil" aria-hidden="true"></div>
            <div class="dash-promo-content">
              <p class="dash-promo-eyebrow">Tournament</p>
              <h2 class="dash-promo-title focus-text">Circuit Open — Week <span class="focus-accent">3</span></h2>
              <p class="dash-promo-text">Compete in ranked brackets, earn season rewards, and prove your link control under pressure.</p>
              <div class="dash-promo-meta">
                <span>Prize pool · 50,000 LP</span>
                <span>Format · Solo queue</span>
                <span>Ends · Sunday 23:59 UTC</span>
              </div>
              <button type="button" class="dash-btn-play" data-nav="ranking" id="promo-rankings-btn">View Rankings</button>
            </div>
          </div>
        </section>

        <div class="dash-content dash-content--pad">
          <!-- ABOUT + FEATURE STRIP -->
          <section class="dash-section dash-about">
            <div class="dash-about-layout">
              <div class="dash-about-panel">
                <p class="dash-about-eyebrow">About LINK</p>
                <h2 class="dash-about-title focus-text">A competitive arena built around energy, movement, and <span class="focus-accent">connection</span>.</h2>
                <p class="dash-about-text">
                  LINK is a fast multiplayer battle game where every attack draws a glowing link across the map.
                  Capture nodes to gather energy, turn enemy ground into your path, and form Energy Zones by connecting three links into a triangle.
                </p>
                <p class="dash-about-text dash-about-text--soft">
                  Whether you queue for a quick match or push for Champion, the battlefield rewards clear decisions and sharp timing.
                </p>
              </div>
              <div class="dash-feature-list" aria-label="Core features">
                ${featureItem('01', 'Energy Capture', 'Secure nodes and control the flow of power across the map.')}
                ${featureItem('02', 'Link Combat', 'Every attack leaves a path. Use it to accelerate — or deny theirs.')}
                ${featureItem('03', 'Ranked Ladder', 'Climb from Rookie to Champion with seasonal resets and rewards.')}
                ${featureItem('04', 'Custom Lobbies', 'Train, scrim, and host private matches with friends.')}
              </div>
            </div>
          </section>
        </div>

        <!-- MATCH STATS / SCREENSHOT BANNER -->
        <section class="dash-promo-bleed dash-promo-bleed--stats">
          <div class="dash-promo dash-promo--split">
            <img class="dash-promo-bg" src="${IMG.banner2}" alt="" loading="lazy" decoding="async" />
            <div class="dash-promo-veil dash-promo-veil--soft" aria-hidden="true"></div>
            <div class="dash-promo-content dash-promo-content--end">
              <p class="dash-promo-eyebrow">Live season</p>
              <h2 class="dash-promo-title focus-text">Built for the <span class="focus-accent">climb</span></h2>
              <div class="dash-stat-row">
                ${statCell('2.4M', 'Matches played')}
                ${statCell('48s', 'Avg. time to queue')}
                ${statCell('126', 'Countries active')}
                ${statCell('4', 'Competitive modes')}
              </div>
            </div>
          </div>
        </section>

        <div class="dash-content dash-content--pad">
          <!-- LEADERBOARD PREVIEW -->
          <section class="dash-section dash-lb-preview" id="home-rankings">
            <div class="dash-section-head">
              <div>
                <p class="dash-section-eyebrow">Competitive</p>
                <h2 class="dash-section-title focus-text">Top <span class="focus-accent">players</span></h2>
                <p class="dash-section-desc">This week’s ranked ladder leaders. Climb, defend, and take the crown.</p>
              </div>
              <a class="dash-view-all" href="/leaderboard" data-nav="ranking">Full rankings ${iconArrowRight()}</a>
            </div>
            <div class="dash-lb-grid">
              ${lbCard(1, 'Nyx', 'Champion', '2,840', true)}
              ${lbCard(2, 'Volt', 'Grandmaster', '2,712', false)}
              ${lbCard(3, 'Echo', 'Grandmaster', '2,655', false)}
              ${lbCard(4, 'Rift', 'Master', '2,501', false)}
            </div>
          </section>

          <!-- DOWNLOAD -->
          <section class="dash-section dash-download-block" id="home-download">
            <div class="dash-download-panel">
              <div class="dash-download-copy">
                <p class="dash-download-eyebrow">Get the game</p>
                <h2 class="dash-download-title focus-text">Download for <span class="focus-accent">Windows</span></h2>
                <p class="dash-download-text">
                  Install LINK on your PC and jump into ranked, custom lobbies, and training.
                  Lightweight client. Competitive focus.
                </p>
                <ul class="dash-download-specs">
                  <li>Windows 10 / 11 · 64-bit</li>
                  <li>~1.2 GB install size</li>
                  <li>Controller + keyboard supported</li>
                </ul>
                <button type="button" class="dash-btn-play" id="windows-download-btn">
                  <span class="dash-download-icon">${iconDownload()}</span>
                  Download for Windows
                </button>
                <p class="dash-download-soon">
                  Coming soon on other devices — macOS, Android, and iOS releases are on the way.
                </p>
              </div>
              <div class="dash-download-aside" aria-hidden="true">
                <div class="dash-download-badge">
                  <span class="dash-download-badge-label">Platform</span>
                  <strong>PC</strong>
                </div>
                <div class="dash-download-badge">
                  <span class="dash-download-badge-label">Status</span>
                  <strong>Open Beta</strong>
                </div>
                <div class="dash-download-badge">
                  <span class="dash-download-badge-label">Rating</span>
                  <strong>Teen</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- COMMUNITY -->
        <section class="dash-community-bleed">
          <div class="dash-community">
            <img class="dash-community-bg" src="${IMG.community}" alt="" aria-hidden="true" />
            <div class="dash-community-overlay" aria-hidden="true"></div>
            <div class="dash-community-content">
              <p class="dash-community-eyebrow">Players</p>
              <h2 class="focus-text">Join the <span class="focus-accent">community</span></h2>
              <p>Find teammates, share clips, and stay updated on seasons, patches, and events.</p>
              <div class="dash-community-actions">
                <button type="button" class="dash-btn-discord">${iconDiscord()} Discord</button>
                <button type="button" class="dash-btn-learn" data-nav="community">Learn more ${iconArrowRight()}</button>
              </div>
            </div>
          </div>
        </section>

        <footer class="dash-footer">
          <div class="dash-footer-inner">
            <div class="dash-footer-brand">
              ${brandLogo()}
              <span class="focus-text">LIN<span class="focus-accent">K</span></span>
            </div>
            <nav class="dash-footer-nav" aria-label="Footer">
              <a href="/download" data-nav="download">Download</a>
              <a href="/leaderboard" data-nav="ranking">Rankings</a>
              <a href="/community" data-nav="community">Community</a>
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
    <article class="general-card">
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

function featureItem(num: string, title: string, desc: string): string {
  return `
    <article class="dash-feature-item">
      <span class="dash-feature-num">${num}</span>
      <div>
        <h3 class="dash-feature-title">${title}</h3>
        <p class="dash-feature-desc">${desc}</p>
      </div>
    </article>
  `;
}

function statCell(value: string, label: string): string {
  return `
    <div class="dash-stat-cell">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function lbCard(rank: number, name: string, league: string, lp: string, gold: boolean): string {
  return `
    <article class="home-lb-card${gold ? ' is-top' : ''}">
      <span class="home-lb-rank">#${rank}</span>
      <div class="home-lb-meta">
        <h3 class="home-lb-name">${name}</h3>
        <p class="home-lb-league">${league}</p>
      </div>
      <div class="home-lb-lp">
        <strong>${lp}</strong>
        <span>LP</span>
      </div>
    </article>
  `;
}

function brandLogo(): string {
  return `<img class="dash-brand-mark" src="/position/logo.png" alt="" width="48" height="52" decoding="async" />`;
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

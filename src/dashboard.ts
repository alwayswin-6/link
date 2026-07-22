import newsUpdates1 from './assets/news/news-updates-1.png';
import newsUpdates2 from './assets/news/news-updates-2.png';
import newsUpdates3 from './assets/news/news-updates-3.png';
import { chatRoomHTML } from './chat';

export function dashboardHTML(): string {
  return `
  <div id="dashboard" class="dash">
    <aside class="dash-sidebar">
      <div class="dash-brand" aria-label="LINK">
        ${brandLogoSvg()}
      </div>

      <nav class="dash-nav" aria-label="Main">
        <div class="dash-nav-group">
          <a class="dash-nav-item active" href="#/" data-nav="home">
            <span class="dash-nav-icon">${iconHome()}</span>
            <span class="dash-nav-label">Dashboard</span>
          </a>
          <a class="dash-nav-item" href="#play" data-nav="play" id="nav-play">
            <span class="dash-nav-icon">${iconPlay()}</span>
            <span class="dash-nav-label">Games</span>
          </a>
          <a class="dash-nav-item" href="#missions" data-nav="missions" id="nav-missions">
            <span class="dash-nav-icon">${iconMissions()}</span>
            <span class="dash-nav-label">Missions</span>
          </a>
          <a class="dash-nav-item" href="#community" data-nav="community" id="nav-community">
            <span class="dash-nav-icon">${iconCommunity()}</span>
            <span class="dash-nav-label">Community</span>
          </a>
          <a class="dash-nav-item" href="#leaderboard" data-nav="ranking" id="nav-ranking">
            <span class="dash-nav-icon">${iconLeaderboard()}</span>
            <span class="dash-nav-label">Rankings</span>
          </a>
        </div>

        <div class="dash-nav-group secondary">
          <a class="dash-nav-item" href="#settings" data-nav="settings" id="nav-settings">
            <span class="dash-nav-icon">${iconSettings()}</span>
            <span class="dash-nav-label">Settings</span>
          </a>
          <a class="dash-nav-item" href="#profile" data-nav="profile" id="nav-profile">
            <span class="dash-nav-icon">${iconProfile()}</span>
            <span class="dash-nav-label">Profile</span>
          </a>
          <a class="dash-nav-item" href="#help" data-nav="help" id="nav-help">
            <span class="dash-nav-icon">${iconHelp()}</span>
            <span class="dash-nav-label">Help</span>
          </a>
        </div>
      </nav>

      <div class="dash-profile-card" id="dash-profile-card" hidden>
        <div class="dash-profile-top">
          <div class="dash-profile-avatar"><img class="dash-fill" src="/position/user1.png" alt="Player avatar" /></div>
          <div class="dash-profile-id">
            <div class="dash-profile-name">Guest</div>
            <span class="dash-profile-rank">${iconRank()} Platinum II</span>
          </div>
        </div>
        <div class="dash-xp-row">
          <div class="dash-xp-bar"><div class="dash-xp-fill" style="width:87.5%"></div></div>
          <div class="dash-xp-text">2,450 / 2,800 XP</div>
        </div>
        <div class="dash-profile-actions">
          <button type="button" class="dash-profile-btn primary">View profile</button>
          <button type="button" class="dash-profile-btn ghost">Statistics</button>
        </div>
      </div>

      <div class="dash-sidebar-foot">
        <div class="dash-socials">
          <button type="button" class="dash-social" aria-label="Discord">${iconDiscord()}</button>
          <button type="button" class="dash-social" aria-label="Twitter">${iconTwitter()}</button>
          <button type="button" class="dash-social" aria-label="YouTube">${iconYoutube()}</button>
          <button type="button" class="dash-social" aria-label="Twitch">${iconTwitch()}</button>
        </div>
        <div class="dash-version">v0.1.0</div>
      </div>
    </aside>

    <div class="dash-main">
      <header class="dash-topbar">
        <div class="dash-topbar-spacer"></div>
        <div class="dash-topbar-right">
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
      </header>

      ${chatRoomHTML()}

      <div class="dash-scroll" id="dash-home">
        <!-- HERO -->
        <section class="dash-hero">
          <div class="dash-hero-copy">
            <p class="dash-hero-eyebrow">Competitive platform</p>
            <h1 class="dash-hero-title">Your Competitive Gaming Hub</h1>
            <p class="dash-hero-sub">
              A focused space to queue matches, track progress, and compete with clarity.
              Built for players who value structure over spectacle.
            </p>
            <div class="dash-hero-actions">
              <button type="button" class="dash-btn-play" id="play-now-btn">
                <span class="dash-download-icon">${iconDownload()}</span>
                Download
              </button>
              <button type="button" class="dash-btn-how">How to play</button>
            </div>
            <div class="dash-hero-stats">
              <div class="dash-stat">
                <span class="dash-stat-label">Players online</span>
                <span class="dash-stat-value">24,582</span>
                <span class="dash-stat-trend up">+12% today</span>
              </div>
              <div class="dash-stat">
                <span class="dash-stat-label">Matches today</span>
                <span class="dash-stat-value">8,140</span>
                <span class="dash-stat-trend up">+4.2%</span>
              </div>
              <div class="dash-stat">
                <span class="dash-stat-label">Avg. queue</span>
                <span class="dash-stat-value">15s</span>
                <span class="dash-stat-trend">Stable</span>
              </div>
            </div>
          </div>
          <div class="dash-hero-visual">
            <div class="dash-hero-slides" id="hero-slides">
              <img class="dash-hero-slide active" src="/position/image1.png" alt="" data-index="0" loading="eager" decoding="async" />
              <img class="dash-hero-slide" src="/position/image2.png" alt="" data-index="1" loading="lazy" decoding="async" />
              <img class="dash-hero-slide" src="/position/image3.png" alt="" data-index="2" loading="lazy" decoding="async" />
              <img class="dash-hero-slide" src="/position/image4.png" alt="" data-index="3" loading="lazy" decoding="async" />
            </div>
            <div class="dash-hero-dots" id="hero-dots">
              <button type="button" class="active" data-index="0" aria-label="Slide 1"></button>
              <button type="button" data-index="1" aria-label="Slide 2"></button>
              <button type="button" data-index="2" aria-label="Slide 3"></button>
              <button type="button" data-index="3" aria-label="Slide 4"></button>
            </div>
          </div>
        </section>

        <!-- GAME MODES -->
        <section class="dash-section feat">
          <div class="dash-section-head">
            <div>
              <h2 class="dash-section-title">Game modes</h2>
              <p class="dash-section-desc">Choose how you want to compete.</p>
            </div>
            <a class="dash-view-all gm-viewall" href="#">View all ${iconArrowRight()}</a>
          </div>
          <div class="dash-modes">
            ${modeCard({
              color: 'purple',
              icon: iconModeQuick(),
              title: 'Quick Match',
              desc: 'Jump into fast online battles with random players.',
              chips: [
                [iconUsers(), '2–8 Players'],
                [iconMap(), 'Random maps'],
                [iconBolt(), 'Avg queue: 15s'],
              ],
              button: 'Download',
              status: 'Live',
              buttonId: 'mode-quick',
            })}
            ${modeCard({
              color: 'blue',
              icon: iconModeRanked(),
              title: 'Ranked',
              desc: 'Compete against skilled players and climb the seasonal leaderboard.',
              chips: [
                [iconTrophySimple(), 'Competitive'],
                [iconCalendar(), 'Season 1'],
                [iconStar(), 'Skill rating'],
              ],
              button: 'Start ranked',
              badge: 'Competitive',
              featured: true,
              buttonId: 'mode-ranked',
            })}
            ${modeCard({
              color: 'orange',
              icon: iconModeCustom(),
              title: 'Custom Match',
              desc: 'Create private rooms or join custom community games.',
              chips: [
                [iconUsers(), 'Private lobby'],
                [iconPlay(), 'Invite friends'],
                [iconSettings(), 'Custom rules'],
              ],
              button: 'Create lobby',
              status: 'Open',
              buttonId: 'mode-custom',
            })}
            ${modeCard({
              color: 'green',
              icon: iconModeTraining(),
              title: 'Training',
              desc: 'Practice mechanics, movement, and abilities without pressure.',
              chips: [
                [iconTarget(), 'Practice arena'],
                [iconBot(), 'AI bots'],
                [iconBook(), 'Tutorials'],
              ],
              button: 'Start training',
              status: 'AI ready',
              buttonId: 'mode-training',
            })}
          </div>
        </section>

        <!-- DAILY MISSIONS -->
        <section class="dash-section feat">
          <div class="dash-section-head">
            <div>
              <h2 class="dash-section-title">Daily missions</h2>
              <p class="dash-section-desc">Structured objectives with clear progress and rewards.</p>
            </div>
            <div class="dash-section-meta">
              <span class="dash-reset">${iconClock()} Resets in 12h 45m</span>
              <a class="dash-view-all" href="#">View all ${iconArrowRight()}</a>
            </div>
          </div>
          <div class="dash-missions">
            ${missionCard('purple', '/position/logo1.png', 'Play 3 Matches', 'Complete three online matches in any mode.', '2 / 3', 66.67, '500')}
            ${missionCard('gold', '/position/logo2.png', 'Capture 10 Nodes', 'Capture objective nodes during multiplayer battles.', '6 / 10', 60, '700')}
            ${missionCard('blue', '/position/logo3.png', 'Win 2 Matches', 'Achieve two victories to earn bonus experience.', '1 / 2', 50, '600')}
          </div>
        </section>

        <!-- EVENTS -->
        <section class="dash-section feat">
          <div class="dash-section-head">
            <div>
              <h2 class="dash-section-title">Events</h2>
              <p class="dash-section-desc">Limited-time challenges and seasonal rewards.</p>
            </div>
            <a class="dash-view-all" href="#">View all ${iconArrowRight()}</a>
          </div>
          <div class="dash-event">
            <img class="evt-bg" src="/position/NEON%20STORM.png" alt="" aria-hidden="true" />
            <div class="evt-overlay" aria-hidden="true"></div>
            <div class="evt-content">
              <div class="evt-left">
                <div class="evt-label">Limited time</div>
                <h3 class="evt-title">Neon Storm</h3>
                <p class="evt-desc">Complete missions and earn exclusive rewards while the event is live.</p>
                <div class="evt-countdown">${iconClock()}<span>Ends in 6d 12h 45m</span></div>
                <div class="evt-rewards-preview">
                  <span class="evt-rewards-heading">Reward preview</span>
                  <div class="evt-chips">
                    <span class="evt-chip">${iconBolt()} XP Boost</span>
                    <span class="evt-chip">${iconSkin()} Exclusive Skin</span>
                    <span class="evt-chip">${iconBadge()} Player Badge</span>
                    <span class="evt-chip">${iconCoin()} Event Currency</span>
                  </div>
                </div>
                <button type="button" class="evt-view-btn">View event ${iconArrowRight()}</button>
              </div>
              <div class="evt-actions">
                <button type="button" class="evt-action" data-tip="Challenges" aria-label="Challenges">${iconTrophySimple()}</button>
                <button type="button" class="evt-action" data-tip="Rewards" aria-label="Rewards">${iconGift()}</button>
                <button type="button" class="evt-action" data-tip="Leaderboard" aria-label="Leaderboard">${iconRanking()}</button>
                <button type="button" class="evt-action" data-tip="Store" aria-label="Store">${iconBag()}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- NEWS -->
        <section class="dash-section feat">
          <div class="dash-section-head">
            <div>
              <h2 class="dash-section-title">News &amp; updates</h2>
              <p class="dash-section-desc">Product notes, tips, and platform announcements.</p>
            </div>
            <a class="dash-view-all" href="#">View all ${iconArrowRight()}</a>
          </div>
          <div class="dash-news">
            ${newsCard(
              'update',
              'Update',
              'Patch 0.1.0 Notes',
              'Balance adjustments, gameplay improvements, bug fixes, and quality-of-life updates are now available.',
              'May 20, 2024',
              newsUpdates1
            )}
            ${newsCard(
              'news',
              'News',
              'Welcome to LINK',
              'Welcome to the first season of LINK. Discover new features, competitive modes, and community events.',
              'May 18, 2024',
              newsUpdates2
            )}
            ${newsCard(
              'tips',
              'Tips',
              'New to LINK?',
              'Learn the fundamentals, improve your skills, and discover advanced strategies for every match.',
              'May 16, 2024',
              newsUpdates3
            )}
          </div>
        </section>

        <!-- LEADERBOARD -->
        <section class="dash-section feat" id="section-ranking">
          <div class="dash-section-head">
            <div>
              <h2 class="dash-section-title">Leaderboard</h2>
              <p class="dash-section-desc">Top performers this season.</p>
            </div>
            <a class="dash-view-all gold lb-viewall" href="#">View full leaderboard ${iconArrowRight()}</a>
          </div>
          <div class="dash-leaderboard">
            ${leaderCard({ rank: 1, name: 'ShadowLink', league: 'Champion', rating: '3,450', winRate: '82%', streak: '9', matches: '285', progress: 84, next: 'Grandmaster', clan: 'LNK' })}
            ${leaderCard({ rank: 2, name: 'NeonX', league: 'Master', rating: '3,210', winRate: '78%', streak: '7', matches: '268', progress: 76, next: 'Champion', clan: 'VYU' })}
            ${leaderCard({ rank: 3, name: 'CyberNull', league: 'Diamond', rating: '2,980', winRate: '74%', streak: '5', matches: '249', progress: 68, next: 'Master', clan: 'NUL' })}
            ${leaderCard({ rank: 4, name: 'PulseFire', league: 'Elite', rating: '2,750', winRate: '70%', streak: '4', matches: '231', progress: 60, next: 'Diamond', clan: 'FIR' })}
            ${leaderCard({ rank: 5, name: 'LinkMaster', league: 'Legend', rating: '2,540', winRate: '66%', streak: '3', matches: '210', progress: 52, next: 'Elite', clan: 'LMX' })}
          </div>
        </section>

        <!-- COMMUNITY -->
        <section class="dash-community">
          <img class="dash-community-bg" src="/position/JOIN%20OUR%20COMMUNITY.png" alt="" aria-hidden="true" />
          <div class="dash-community-overlay" aria-hidden="true"></div>
          <div class="dash-community-content">
            <h2>Join the community</h2>
            <p>Connect with players, share strategies, and stay informed about upcoming seasons.</p>
            <div class="dash-community-actions">
              <button type="button" class="dash-btn-discord">${iconDiscord()} Join Discord</button>
              <button type="button" class="dash-btn-learn">Learn more ${iconArrowRight()}</button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <nav class="dash-mobile-nav" aria-label="Mobile">
      <a class="dash-mobile-item active" href="#/" data-nav="home">${iconHome()}<span>Home</span></a>
      <a class="dash-mobile-item" href="#play" data-nav="play">${iconPlay()}<span>Games</span></a>
      <a class="dash-mobile-item" href="#missions" data-nav="missions">${iconMissions()}<span>Missions</span></a>
      <a class="dash-mobile-item" href="#leaderboard" data-nav="ranking">${iconLeaderboard()}<span>Ranks</span></a>
      <a class="dash-mobile-item" href="#profile" data-nav="profile">${iconProfile()}<span>Profile</span></a>
    </nav>
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

function missionCard(
  color: string,
  logo: string,
  title: string,
  desc: string,
  count: string,
  pct: number,
  xp: string
): string {
  return `
    <div class="msn-card ${color}">
      <div class="msn-icon"><img src="${logo}" alt="" /></div>
      <div class="msn-body">
        <div class="msn-head">
          <h3 class="msn-title">${title}</h3>
          <span class="msn-count">${count}</span>
        </div>
        <p class="msn-desc">${desc}</p>
        <div class="msn-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="msn-actions">
        <span class="msn-xp">${iconBolt()} ${xp} XP</span>
        <button type="button" class="msn-track">Track ${iconArrowRight()}</button>
      </div>
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
    <article class="dash-news-card">
      <div class="dash-news-thumb">
        <img src="${img}" alt="${title}" />
        <span class="dash-news-shade" aria-hidden="true"></span>
        <span class="dash-news-badge ${tag}">${label}</span>
      </div>
      <div class="dash-news-body">
        <h4>${title}</h4>
        <p class="dash-news-desc">${desc}</p>
        <div class="dash-news-foot">
          <span class="dash-news-date">${iconCalendar()} ${date}</span>
          <span class="dash-news-more">Read more ${iconArrowRight()}</span>
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
  icon: string;
  title: string;
  desc: string;
  chips: [string, string][];
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
  const chips = m.chips
    .map(
      ([ico, text]) =>
        `<span class="gm-chip"><span class="gm-chip-ico">${ico}</span><span class="gm-chip-label">${text}</span></span>`
    )
    .join('');
  const idAttr = m.buttonId ? ` id="${m.buttonId}"` : '';
  return `
    <div class="gm-card ${m.color}${m.featured ? ' featured' : ''}">
      ${statusEl}
      <div class="gm-icon">${m.icon}</div>
      <h3 class="gm-title">${m.title}</h3>
      <p class="gm-desc">${m.desc}</p>
      <div class="gm-chips">${chips}</div>
      <button type="button" class="gm-btn"${idAttr}>${m.button}</button>
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
    p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : 'purple';
  return `
    <button type="button" class="lb-card ${tier}" aria-label="${p.name} — rank ${p.rank}">
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
        <span class="lb-season">Season 1</span>
      </span>
      <span class="lb-stats">
        <span class="lb-stat"><span class="lb-stat-label">Rating</span><span class="lb-stat-value">${p.rating}</span></span>
        <span class="lb-stat"><span class="lb-stat-label">Win rate</span><span class="lb-stat-value">${p.winRate}</span></span>
        <span class="lb-stat"><span class="lb-stat-label">Streak</span><span class="lb-stat-value">${p.streak}</span></span>
        <span class="lb-stat"><span class="lb-stat-label">Matches</span><span class="lb-stat-value">${p.matches}</span></span>
      </span>
      <span class="lb-progress">
        <span class="lb-bar"><span style="width:${p.progress}%"></span></span>
        <span class="lb-progress-text">${p.progress}% to ${p.next}</span>
      </span>
    </button>
  `;
}

/** Sidebar brand mark — clean wordmark */
function brandLogoSvg(): string {
  return `
    <svg class="dash-brand-logo" viewBox="0 0 160 48" role="img" aria-label="LINK" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="34"
        font-family="Inter, system-ui, sans-serif"
        font-size="32" font-weight="700" letter-spacing="-0.04em"
        fill="currentColor">LINK</text>
      <rect x="108" y="12" width="6" height="6" rx="1" fill="#3B82F6"/>
    </svg>
  `;
}

function iconHome() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z"/></svg>`;
}
function iconPlay() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`;
}
function iconChat() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/></svg>`;
}
function iconLeaderboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`;
}
function iconMissions() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
}
function iconCommunity() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
}
function iconSettings() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
}
function iconProfile() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`;
}
function iconHelp() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1-1.3 1.8V14"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/></svg>`;
}
function iconRank() {
  return `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 1 3 3v4c0 3.2 2.2 5.5 5 6 2.8-.5 5-2.8 5-6V3L8 1z"/></svg>`;
}
function iconTheme() {
  return `<svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}
function iconBell() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`;
}
function iconDiscord() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 5.5A16 16 0 0 0 15.5 4l-.7 1.3a14 14 0 0 0-5.6 0L8.5 4A16 16 0 0 0 4 5.5C2 8.7 1.4 11.8 1.6 14.9A16 16 0 0 0 6.5 17l1-1.3a10 10 0 0 1-1.5-.7l.4-.3a11 11 0 0 0 11.2 0l.4.3c-.5.3-1 .5-1.5.7l1 1.3a16 16 0 0 0 4.9-2.1c.4-3.5-.6-6.6-2.4-9.4zM8.7 13.2c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.7 1.6-1.5 1.6zm6.6 0c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.7 1.6-1.5 1.6z"/></svg>`;
}
function iconTwitter() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 2h3l-7 8 8 12h-6l-5-6-5 6H3l7-9L2 2h6l4 5 6-5z"/></svg>`;
}
function iconYoutube() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23 7.5s-.2-1.6-.9-2.3c-.8-.9-1.7-.9-2.1-1C17.1 4 12 4 12 4s-5.1 0-7.9.2c-.5.1-1.3.1-2.1 1C1.2 5.9 1 7.5 1 7.5S.8 9.4.8 11.2v1.6c0 1.9.2 3.7.2 3.7s.2 1.6.9 2.3c.8.9 1.9.8 2.4.9 1.7.2 7.7.2 7.7.2s5.1 0 7.9-.2c.5-.1 1.3-.1 2.1-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.7v-1.6c0-1.8-.2-3.7-.2-3.7zM9.8 14.8V8.7l6.2 3.05-6.2 3.05z"/></svg>`;
}
function iconTwitch() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 2 2 5v15h5v2h3l2-2h4l6-6V2H4zm15 10-3 3h-4l-2 2v-2H7V4h12v8zM14 7h2v5h-2V7zm-5 0h2v5H9V7z"/></svg>`;
}
function iconClock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
}
function iconBolt() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>`;
}
function iconSkin() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 5 6l2 2 1-1v13h8V7l1 1 2-2-3-3h-3a2 2 0 0 1-4 0H8z"/></svg>`;
}
function iconBadge() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 22l5-3 5 3-1.5-9"/></svg>`;
}
function iconCoin() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 2.5-5 1.5-5 4a2.5 2 0 0 0 5 0"/></svg>`;
}
function iconArrowRight() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
}
function iconDownload() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
}
function iconTrophySimple() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/></svg>`;
}
function iconGift() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 3 8.5 3 6 5 6 5s.5 2 6 2zM12 7s1-4 3.5-4S18 5 18 5s-.5 2-6 2z"/></svg>`;
}
function iconRanking() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`;
}
function iconBag() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>`;
}
function iconCalendar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`;
}
function iconUsers() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
}
function iconMap() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>`;
}
function iconStar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3z"/></svg>`;
}
function iconTarget() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>`;
}
function iconBot() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V5M9 13h.01M15 13h.01M9 17h6"/></svg>`;
}
function iconBook() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z"/></svg>`;
}

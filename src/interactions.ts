import { getAuthUser, openAuthModal, requireAuth } from './auth';
import { ensureUiChrome, escapeHtml, openModal, showToast } from './ui';

export type InteractionCallbacks = {
  showGame: () => void;
  showChat: () => void;
  showHome: () => void;
  setActiveNav: (nav: string) => void;
};

function lobbyCode(): string {
  return `LINK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function playIfAuthed(cb: InteractionCallbacks): void {
  if (!requireAuth()) return;
  cb.showGame();
}

export function initInteractions(cb: InteractionCallbacks): void {
  ensureUiChrome();
  const dash = document.querySelector('#dashboard');
  if (!dash) return;

  // ——— Sidebar profile ———
  dash.querySelector('.dash-profile-btn.primary')?.addEventListener('click', () => {
    const user = getAuthUser();
    const name = user?.username ?? 'Guest';
    openModal({
      title: 'PLAYER PROFILE',
      bodyHtml: `
        <p><strong>${escapeHtml(name.toUpperCase())}</strong> · Platinum II</p>
        <div class="stat-grid">
          <div class="stat-cell">Level<strong>24</strong></div>
          <div class="stat-cell">XP<strong>2450 / 2800</strong></div>
          <div class="stat-cell">Clan<strong>LNK</strong></div>
          <div class="stat-cell">Status<strong>${user ? 'Online' : 'Guest'}</strong></div>
        </div>
        <p>${user ? `Signed in as ${escapeHtml(user.email)}` : 'Sign up to save your progress and climb the ranks.'}</p>
      `,
      actions: user
        ? [{ label: 'CLOSE', primary: true }]
        : [
            { label: 'SIGN UP', primary: true, onClick: () => openAuthModal('signup') },
            { label: 'CLOSE' },
          ],
    });
  });

  dash.querySelector('.dash-profile-btn.ghost')?.addEventListener('click', () => {
    openModal({
      title: 'STATISTICS',
      bodyHtml: `
        <div class="stat-grid">
          <div class="stat-cell">Matches<strong>128</strong></div>
          <div class="stat-cell">Wins<strong>74</strong></div>
          <div class="stat-cell">Win rate<strong>58%</strong></div>
          <div class="stat-cell">Best streak<strong>9</strong></div>
          <div class="stat-cell">Nodes captured<strong>1,240</strong></div>
          <div class="stat-cell">Zones formed<strong>86</strong></div>
        </div>
        <p>Stats update after online matches. Training games do not affect ranked rating.</p>
      `,
    });
  });

  const socialUrls: Record<string, string> = {
    Discord: 'https://discord.com/',
    Twitter: 'https://x.com/',
    YouTube: 'https://youtube.com/',
    Twitch: 'https://twitch.tv/',
  };
  dash.querySelectorAll<HTMLButtonElement>('.dash-social').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.getAttribute('aria-label') || 'Social';
      const url = socialUrls[label];
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      showToast(`Opening ${label}…`);
    });
  });

  // ——— Topbar ———
  const topRight = dash.querySelector('.dash-topbar-right');
  topRight?.querySelectorAll<HTMLButtonElement>('.dash-icon-btn').forEach((btn) => {
    if (btn.id === 'theme-toggle' || btn.id === 'topbar-chat') return;
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('message')) {
      btn.addEventListener('click', () => {
        cb.setActiveNav('chat');
        cb.showChat();
        showToast('Messages opened in Chat');
      });
    } else if (label.includes('notification')) {
      btn.addEventListener('click', () => toggleNotifications(btn));
    }
  });

  dash.querySelector('.dash-currency-plus')?.addEventListener('click', () => {
    openModal({
      title: 'CURRENCY SHOP',
      bodyHtml: `
        <p>Spend LINK Credits on skins, boosts, and battle passes.</p>
        <div class="stat-grid">
          <div class="stat-cell">Starter Pack<strong>500 ₡ · $4.99</strong></div>
          <div class="stat-cell">Pro Bundle<strong>2,500 ₡ · $19.99</strong></div>
        </div>
        <p>Purchases are disabled in this prototype build.</p>
      `,
      actions: [
        { label: 'BUY (DEMO)', primary: true, onClick: () => showToast('Purchase simulated — +500 credits') },
        { label: 'CLOSE' },
      ],
    });
  });

  // ——— Hero ———
  dash.querySelector('.dash-btn-how')?.addEventListener('click', () => {
    openModal({
      title: 'HOW TO PLAY',
      bodyHtml: `
        <ul>
          <li><kbd>A</kbd>/<kbd>D</kbd> or ←/→ — Move</li>
          <li><kbd>W</kbd>/<kbd>Space</kbd>/↑ — Jump</li>
          <li><kbd>J</kbd>/<kbd>Z</kbd> — Attack (leave energy links)</li>
          <li><kbd>K</kbd>/<kbd>X</kbd> — Dash</li>
        </ul>
        <p>Your links speed you up. Enemy links slow you. Connect three links into a triangle to form an Energy Zone and rack up points.</p>
        <p>Highest energy when the timer hits zero wins.</p>
      `,
      actions: [
        { label: 'PLAY NOW', primary: true, onClick: () => playIfAuthed(cb) },
        { label: 'CLOSE' },
      ],
    });
  });

  // ——— Game modes ———
  dash.querySelector('#mode-ranked')?.addEventListener('click', () => {
    if (!requireAuth()) return;
    showToast('Searching ranked match…');
    window.setTimeout(() => {
      showToast('Match found — joining arena');
      cb.showGame();
    }, 700);
  });
  dash.querySelector('#mode-custom')?.addEventListener('click', () => {
    if (!requireAuth()) return;
    const code = lobbyCode();
    openModal({
      title: 'CUSTOM LOBBY',
      bodyHtml: `
        <p>Private lobby created.</p>
        <div class="stat-grid">
          <div class="stat-cell">Lobby code<strong>${code}</strong></div>
          <div class="stat-cell">Slots<strong>1 / 8</strong></div>
        </div>
        <p>Share the code with friends, then start when ready.</p>
      `,
      actions: [
        {
          label: 'COPY CODE',
          primary: true,
          onClick: () => {
            void navigator.clipboard?.writeText(code);
            showToast(`Copied ${code}`);
          },
        },
        { label: 'ENTER ARENA', onClick: () => cb.showGame() },
        { label: 'CLOSE' },
      ],
    });
  });
  dash.querySelector('#mode-training')?.addEventListener('click', () => {
    if (!requireAuth()) return;
    showToast('Launching training arena with AI bots');
    cb.showGame();
  });

  // ——— View All links ———
  dash.querySelectorAll<HTMLAnchorElement>('.dash-view-all').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (a.classList.contains('lb-viewall')) {
        openModal({
          title: 'FULL LEADERBOARD',
          bodyHtml: `
            <p>Season 1 — global standings (top 5 shown on home).</p>
            <ul>
              <li>#1 ShadowLink — 3,450</li>
              <li>#2 NeonX — 3,210</li>
              <li>#3 CyberNull — 2,980</li>
              <li>#4 PulseFire — 2,750</li>
              <li>#5 LinkMaster — 2,540</li>
              <li>#6 VoltArrow — 2,410</li>
              <li>#7 GridWalker — 2,290</li>
              <li>#8 ApexNode — 2,175</li>
            </ul>
          `,
          actions: [
            {
              label: 'GO TO RANKING',
              primary: true,
              onClick: () => {
                cb.setActiveNav('ranking');
                cb.showHome();
                document.querySelector('#section-ranking')?.scrollIntoView({ behavior: 'smooth' });
              },
            },
            { label: 'CLOSE' },
          ],
        });
        return;
      }
      const head = a.closest('.dash-section-head')?.querySelector('h2')?.textContent?.trim() || 'Section';
      showToast(`Showing all — ${head.replace(/\s+/g, ' ')}`);
    });
  });

  // ——— Missions ———
  dash.querySelectorAll<HTMLButtonElement>('.msn-track').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.msn-card');
      const title = card?.querySelector('.msn-title')?.textContent?.trim() || 'Mission';
      const on = btn.classList.toggle('is-tracking');
      btn.textContent = on ? 'TRACKING ✓' : 'TRACK ›';
      showToast(on ? `Now tracking: ${title}` : `Stopped tracking: ${title}`);
    });
  });

  // ——— Events ———
  dash.querySelector('.evt-view-btn')?.addEventListener('click', () => {
    openModal({
      title: 'NEON STORM',
      bodyHtml: `
        <p>Limited-time event. Complete challenges to unlock exclusive rewards.</p>
        <div class="stat-grid">
          <div class="stat-cell">Ends in<strong>6d 12h 45m</strong></div>
          <div class="stat-cell">Your progress<strong>3 / 10</strong></div>
        </div>
        <ul>
          <li>XP Boost · Exclusive Skin · Player Badge · Event Currency</li>
        </ul>
      `,
      actions: [
        { label: 'JOIN EVENT', primary: true, onClick: () => showToast('Neon Storm joined — challenges unlocked') },
        { label: 'CLOSE' },
      ],
    });
  });

  dash.querySelectorAll<HTMLButtonElement>('.evt-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tip = btn.dataset.tip || 'Event';
      const copy: Record<string, string> = {
        Challenges: 'Complete 10 event missions before the timer ends.',
        Rewards: 'Claim XP boosts, skins, and Neon Storm currency.',
        Leaderboard: 'Climb the event ladder for exclusive finishes.',
        Store: 'Spend event currency on limited cosmetics.',
      };
      openModal({
        title: tip.toUpperCase(),
        bodyHtml: `<p>${copy[tip] || 'Event feature ready.'}</p>`,
        actions:
          tip === 'Leaderboard'
            ? [
                {
                  label: 'VIEW RANKING',
                  primary: true,
                  onClick: () => {
                    cb.setActiveNav('ranking');
                    cb.showHome();
                    document.querySelector('#section-ranking')?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
                { label: 'CLOSE' },
              ]
            : [{ label: 'CLOSE', primary: true }],
      });
    });
  });

  // ——— News ———
  dash.querySelectorAll<HTMLElement>('.dash-news-card').forEach((card) => {
    card.style.cursor = 'pointer';
    card.tabIndex = 0;
    const open = () => {
      const title = card.querySelector('h4')?.textContent?.trim() || 'News';
      const desc = card.querySelector('.dash-news-desc')?.textContent?.trim() || '';
      const date = card.querySelector('.dash-news-date')?.textContent?.trim() || '';
      const badge = card.querySelector('.dash-news-badge')?.textContent?.trim() || 'UPDATE';
      openModal({
        title,
        bodyHtml: `<p><em>${escapeHtml(badge)}</em> · ${escapeHtml(date)}</p><p>${escapeHtml(desc)}</p><p>Stay tuned for more seasonal content, balance changes, and community events.</p>`,
      });
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  // ——— Leaderboard cards ———
  dash.querySelectorAll<HTMLButtonElement>('.lb-card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.querySelector('.lb-name')?.textContent?.trim() || 'Player';
      const league = card.querySelector('.lb-league')?.textContent?.trim() || '';
      const rank = card.querySelector('.lb-rank')?.textContent?.trim() || '';
      const stats = Array.from(card.querySelectorAll('.lb-stat'))
        .map((s) => s.textContent?.trim())
        .filter(Boolean)
        .join(' · ');
      openModal({
        title: name.toUpperCase(),
        bodyHtml: `
          <p>${escapeHtml(rank)} · ${escapeHtml(league)}</p>
          <p>${escapeHtml(stats)}</p>
          <p>Challenge this player in Ranked when online, or send a friend request from Chat.</p>
        `,
        actions: [
          {
            label: 'OPEN CHAT',
            primary: true,
            onClick: () => {
              cb.setActiveNav('chat');
              cb.showChat();
            },
          },
          { label: 'CLOSE' },
        ],
      });
    });
  });

  // ——— Community ———
  dash.querySelector('.dash-btn-discord')?.addEventListener('click', () => {
    window.open('https://discord.com/', '_blank', 'noopener,noreferrer');
    showToast('Opening Discord…');
  });
  dash.querySelector('.dash-btn-learn')?.addEventListener('click', () => {
    openModal({
      title: 'COMMUNITY',
      bodyHtml: `
        <p>Join Discord for scrims, patch notes, and creator programs.</p>
        <ul>
          <li>Weekly tournaments</li>
          <li>Clip contests</li>
          <li>Direct feedback to the LINK team</li>
        </ul>
      `,
      actions: [
        {
          label: 'JOIN DISCORD',
          primary: true,
          onClick: () => window.open('https://discord.com/', '_blank', 'noopener,noreferrer'),
        },
        { label: 'CLOSE' },
      ],
    });
  });

}

function toggleNotifications(bell: HTMLButtonElement): void {
  ensureUiChrome();
  const panel = document.querySelector<HTMLDivElement>('#link-notify')!;
  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `
    <h3>NOTIFICATIONS</h3>
    <div class="n-item">Daily missions reset in 12h<span class="n-meta">System · just now</span></div>
    <div class="n-item">Neon Storm event is live<span class="n-meta">Events · 2h ago</span></div>
    <div class="n-item">Friend request from NeonX<span class="n-meta">Social · yesterday</span></div>
  `;
  bell.classList.remove('has-dot');
  const close = (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest('#link-notify') || (ev.target as HTMLElement).closest('[aria-label="Notifications"]')) {
      return;
    }
    panel.hidden = true;
    document.removeEventListener('click', close);
  };
  window.setTimeout(() => document.addEventListener('click', close), 0);
}

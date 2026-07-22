import { ensureUiChrome, showToast } from './ui';
import {
  type ArticleData,
  openArticle,
  openCommunity,
  openDownload,
  openEvent,
  openHowToPlay,
  openMissions,
  openNewsList,
  openPlayer,
  openProfile,
  openRanking,
  openShop,
  openStatistics,
} from './pages';

export type InteractionCallbacks = {
  showChat: () => void;
  setActiveNav: (nav: string) => void;
};

function collectArticles(dash: Element): ArticleData[] {
  return Array.from(dash.querySelectorAll<HTMLElement>('.dash-news-card')).map((card) => ({
    title: card.querySelector('h4')?.textContent?.trim() || 'News',
    desc: card.querySelector('.dash-news-desc')?.textContent?.trim() || '',
    date: (card.querySelector('.dash-news-date')?.textContent?.trim() || '').replace(/^\s*[^A-Za-z0-9]*/, ''),
    badge: card.querySelector('.dash-news-badge')?.textContent?.trim() || 'UPDATE',
    img: card.querySelector<HTMLImageElement>('.dash-news-thumb img')?.src,
  }));
}

export function initInteractions(cb: InteractionCallbacks): void {
  ensureUiChrome();
  const dash = document.querySelector('#dashboard');
  if (!dash) return;

  // ——— Sidebar profile ———
  dash.querySelector('.dash-profile-btn.primary')?.addEventListener('click', () => openProfile());
  dash.querySelector('.dash-profile-btn.ghost')?.addEventListener('click', () => openStatistics());

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
      });
    } else if (label.includes('notification')) {
      btn.addEventListener('click', () => toggleNotifications(btn));
    }
  });

  dash.querySelector('.dash-currency-plus')?.addEventListener('click', () => openShop());
  dash.querySelector('.dash-currency')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.dash-currency-plus')) return;
    openShop();
  });

  // ——— Hero ———
  dash.querySelector('.dash-btn-how')?.addEventListener('click', () => openHowToPlay());

  // ——— Game modes → LINK is an app game, so all launch buttons open the download window ———
  dash.querySelector('#mode-ranked')?.addEventListener('click', () => openDownload());
  dash.querySelector('#mode-custom')?.addEventListener('click', () => openDownload());
  dash.querySelector('#mode-training')?.addEventListener('click', () => openDownload());

  // ——— View All links ———
  dash.querySelectorAll<HTMLAnchorElement>('.dash-view-all').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (a.classList.contains('lb-viewall')) {
        openRanking();
        return;
      }
      const head = a.closest('.dash-section-head')?.querySelector('h2')?.textContent?.trim() || '';
      if (/MISSION/i.test(head)) openMissions();
      else if (/EVENT/i.test(head)) openEvent();
      else if (/NEWS/i.test(head)) openNewsList(collectArticles(dash));
      else if (/MODE/i.test(head)) openDownload();
      else openMissions();
    });
  });

  // ——— Missions (home cards) ———
  dash.querySelectorAll<HTMLButtonElement>('.msn-track').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMissions();
    });
  });

  // ——— Events ———
  dash.querySelector('.evt-view-btn')?.addEventListener('click', () => openEvent());
  dash.querySelectorAll<HTMLButtonElement>('.evt-action').forEach((btn) => {
    btn.addEventListener('click', () => openEvent());
  });

  // ——— News cards ———
  const articles = collectArticles(dash);
  dash.querySelectorAll<HTMLElement>('.dash-news-card').forEach((card, i) => {
    card.style.cursor = 'pointer';
    card.tabIndex = 0;
    const open = () => openArticle(articles[i]);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  // ——— Leaderboard cards ———
  dash.querySelectorAll<HTMLButtonElement>('.lb-card').forEach((card, i) => {
    card.addEventListener('click', () => openPlayer(i));
  });

  // ——— Community ———
  dash.querySelector('.dash-btn-discord')?.addEventListener('click', () => {
    window.open('https://discord.com/', '_blank', 'noopener,noreferrer');
    showToast('Opening Discord…');
  });
  dash.querySelector('.dash-btn-learn')?.addEventListener('click', () => openCommunity());
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
    const t = ev.target as HTMLElement;
    if (t.closest('#link-notify') || t.closest('[aria-label="Notifications"]')) return;
    panel.hidden = true;
    document.removeEventListener('click', close);
  };
  window.setTimeout(() => document.addEventListener('click', close), 0);
}

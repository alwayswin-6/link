import { ensureUiChrome, showToast } from './ui';
import {
  type ArticleData,
  openArticle,
  openCommunity,
  openDownload,
  openEvent,
  openMissions,
  openNewsList,
  openPlayer,
  openRanking,
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

  dash.querySelector('#dash-search')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Enter') return;
    const q = (e.target as HTMLInputElement).value.trim();
    if (q) showToast(`Searching “${q}”…`);
  });

  // ——— Hero / library ———
  dash.querySelectorAll<HTMLButtonElement>('.lib-btn').forEach((btn) => {
    btn.addEventListener('click', () => openDownload());
  });
  dash.querySelector('#join-team-btn')?.addEventListener('click', () => {
    showToast('Team applications open soon');
  });
  dash.querySelectorAll<HTMLButtonElement>('.team-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => showToast('Opening team profile…'));
  });

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
      else if (/MODE|Play|Games/i.test(head)) openDownload();
      else if (/Community/i.test(head)) openCommunity();
      else openDownload();
    });
  });

  // ——— Events ———
  dash.querySelector('.evt-view-btn')?.addEventListener('click', () => openEvent());

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
    <h3>Notifications</h3>
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

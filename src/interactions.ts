import { ensureUiChrome, showToast } from './ui';
import { openCommunity, openDownload } from './pages';
import { openDiscordInvite } from './discord';

export type InteractionCallbacks = {
  showChat: () => void;
  setActiveNav: (nav: string) => void;
};

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

  dash.querySelector('#windows-download-btn')?.addEventListener('click', () => openDownload());

  // ——— Community ———
  dash.querySelector('.dash-btn-discord')?.addEventListener('click', () => {
    openDiscordInvite();
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

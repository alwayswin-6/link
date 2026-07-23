import './style.css';
import { dashboardHTML } from './dashboard';
import { ChatApp } from './chat';
import { initAuth } from './auth';
import { initInteractions } from './interactions';
import {
  initRouter,
  goHome,
  openRanking,
  openDownload,
  openProfile,
  openFortune,
  openMissions,
  openCommunity,
  openHowToPlay,
  openShop,
  openMatches,
  openInventory,
  hidePageView,
} from './pages';
import { showToast } from './ui';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = dashboardHTML();

const dashboard = document.querySelector<HTMLDivElement>('#dashboard')!;
const dashMain = document.querySelector<HTMLElement>('.dash-main')!;
const playNowBtn = document.querySelector<HTMLButtonElement>('#play-now-btn')!;
const modeQuick = document.querySelector<HTMLButtonElement>('#mode-quick')!;
const navPlay = document.querySelector<HTMLAnchorElement>('#nav-play')!;
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
const topbarChat = document.querySelector<HTMLButtonElement>('#topbar-chat')!;
const chatRoot = document.querySelector<HTMLElement>('#chat-room')!;

let chatApp: ChatApp | null = null;

function ensureChat(): ChatApp {
  if (!chatApp) chatApp = new ChatApp(chatRoot);
  return chatApp;
}

function showChat(): void {
  ensureChat();
  hidePageView();
  dashboard.classList.add('is-chat');
  dashMain.classList.add('is-chat');
}

function showHome(): void {
  dashboard.classList.remove('is-chat');
  dashMain.classList.remove('is-chat');
}

function setActiveNav(nav: string): void {
  dashboard.querySelectorAll('.dash-nav-item').forEach((n) => {
    n.classList.toggle('active', (n as HTMLElement).dataset.nav === nav);
  });
}

function handleNav(nav: string | undefined, e?: Event): void {
  if (!nav) return;
  e?.preventDefault();

  if (nav === 'play' || nav === 'download') {
    setActiveNav('download');
    openDownload();
    return;
  }

  if (nav === 'exit') return;

  setActiveNav(nav);

  if (nav === 'chat') {
    showChat();
    return;
  }

  if (nav === 'ranking') {
    openRanking();
    return;
  }

  if (nav === 'matches') {
    openMatches();
    return;
  }

  if (nav === 'missions') {
    openMissions();
    return;
  }

  if (nav === 'community') {
    openCommunity();
    return;
  }

  if (nav === 'inventory') {
    openInventory();
    return;
  }

  if (nav === 'shop') {
    openShop();
    return;
  }

  if (nav === 'profile') {
    openProfile();
    return;
  }

  if (nav === 'help') {
    openHowToPlay();
    return;
  }

  if (nav === 'settings') {
    showHome();
    goHome();
    showToast('Settings coming soon');
    return;
  }

  if (nav === 'fortune') {
    openFortune();
    return;
  }

  goHome();
  showHome();
}

// LINK is a downloadable app game — PLAY entry points open the download window.
playNowBtn.addEventListener('click', () => openDownload());
modeQuick.addEventListener('click', () => openDownload());
document.querySelector('#quick-play-btn')?.addEventListener('click', () => openDownload());
navPlay.addEventListener('click', (e) => handleNav('download', e));

topbarChat.addEventListener('click', () => {
  setActiveNav('chat');
  showChat();
});

document.addEventListener('link:open-profile', () => {
  setActiveNav('profile');
  openProfile();
});

dashboard.querySelectorAll('.dash-nav-item').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (el.id === 'nav-play') return;
    handleNav((el as HTMLElement).dataset.nav, e);
  });
});

/** Light / dark theme toggle — persisted across reloads */
const THEME_KEY = 'link-theme';
const applyTheme = (theme: string): void => {
  dashboard.classList.toggle('theme-light', theme === 'light');
};
applyTheme(localStorage.getItem(THEME_KEY) ?? 'dark');
themeToggle.addEventListener('click', () => {
  const isLight = dashboard.classList.toggle('theme-light');
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
});

/** Hero carousel: image1 → image4 — pauses when tab is hidden to reduce CPU/GPU load */
function initHeroCarousel(): void {
  const slides = Array.from(document.querySelectorAll<HTMLImageElement>('.dash-hero-slide'));
  const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('#hero-dots button'));
  if (slides.length === 0) return;

  let index = 0;
  let timer = 0;
  const INTERVAL_MS = 5000;

  const show = (next: number) => {
    index = ((next % slides.length) + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const on = i === index;
      s.classList.toggle('active', on);
      if (on) s.loading = 'eager';
      else if ('loading' in s) s.loading = 'lazy';
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const start = () => {
    stop();
    if (document.hidden) return;
    timer = window.setInterval(() => show(index + 1), INTERVAL_MS);
  };

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const i = Number(dot.dataset.index);
      if (!Number.isNaN(i)) show(i);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  show(0);
  start();
}

initHeroCarousel();
void initAuth();

initRouter({
  showGame: openDownload,
  showChat,
  setActiveNav,
});

initInteractions({
  showChat,
  setActiveNav,
});

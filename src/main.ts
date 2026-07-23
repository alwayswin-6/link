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
  openMatches,
  openInventory,
  openModerationPage,
  hidePageView,
  setPath,
} from './pages';
import { refreshSession } from './auth';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = dashboardHTML();

const dashboard = document.querySelector<HTMLDivElement>('#dashboard')!;
const dashMain = document.querySelector<HTMLElement>('.dash-main')!;
const playNowBtn = document.querySelector<HTMLButtonElement>('#play-now-btn')!;
const navPlay = document.querySelector<HTMLAnchorElement>('#nav-play')!;
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
const topbarChat = document.querySelector<HTMLButtonElement>('#topbar-chat')!;
const chatRoot = document.querySelector<HTMLElement>('#chat-room')!;

let chatApp: ChatApp | null = null;

function ensureChat(): ChatApp {
  if (!chatApp) chatApp = new ChatApp(chatRoot);
  return chatApp;
}

function showHomeShell(): void {
  dashboard.classList.remove('is-chat');
  dashMain.classList.remove('is-chat');
}

function showChat(updateUrl = true): void {
  ensureChat();
  hidePageView();
  dashboard.classList.add('is-chat');
  dashMain.classList.add('is-chat');
  setActiveNav('chat');
  if (updateUrl) setPath('/chat');
}

function setActiveNav(nav: string): void {
  dashboard.querySelectorAll('.dash-nav-item').forEach((n) => {
    n.classList.toggle('active', (n as HTMLElement).dataset.nav === nav);
  });
}

function openRoute(id: string): void {
  showHomeShell();
  switch (id) {
    case 'download':
      setActiveNav('download');
      openDownload();
      return;
    case 'ranking':
    case 'leaderboard':
      setActiveNav('ranking');
      openRanking();
      return;
    case 'matches':
      setActiveNav('matches');
      openMatches();
      return;
    case 'missions':
      setActiveNav('missions');
      openMissions();
      return;
    case 'community':
      setActiveNav('community');
      openCommunity();
      return;
    case 'inventory':
      setActiveNav('inventory');
      openInventory();
      return;
    case 'profile':
      setActiveNav('profile');
      openProfile();
      return;
    case 'how-to-play':
    case 'help':
      setActiveNav('help');
      openHowToPlay();
      return;
    case 'fortune':
      setActiveNav('fortune');
      openFortune();
      return;
    default:
      goHome();
  }
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

  if (nav === 'profile') {
    openProfile();
    return;
  }

  if (nav === 'help') {
    openHowToPlay();
    return;
  }

  if (nav === 'fortune') {
    openFortune();
    return;
  }

  goHome();
}

/* LINK is a downloadable app game — PLAY entry points open the download window. */
playNowBtn.addEventListener('click', () => openDownload());
document.querySelector('#quick-play-btn')?.addEventListener('click', () => openDownload());
document.querySelector('#windows-download-btn')?.addEventListener('click', () => openDownload());
document.querySelector('#promo-rankings-btn')?.addEventListener('click', () => {
  setActiveNav('ranking');
  openRanking();
});
document.querySelector('.dash-btn-learn')?.addEventListener('click', () => {
  setActiveNav('community');
  openCommunity();
});
navPlay.addEventListener('click', (e) => handleNav('download', e));

topbarChat.addEventListener('click', () => {
  showChat();
});

document.addEventListener('link:open-profile', () => {
  setActiveNav('profile');
  openProfile();
});

document.addEventListener('link:open-moderation', () => {
  setActiveNav('profile');
  openModerationPage();
});

/** Pick up role promotions (ADMIN) without forcing re-login. */
window.setInterval(() => {
  void refreshSession();
}, 45_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshSession();
});

dashboard.querySelectorAll('.dash-nav-item, .dash-footer-nav a').forEach((el) => {
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

void initAuth();

initRouter({
  showGame: openDownload,
  showChat: () => showChat(true),
  setActiveNav,
  openRoute,
  showHomeShell,
});

initInteractions({
  showChat: () => showChat(true),
  setActiveNav,
});

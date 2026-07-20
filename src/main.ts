import './style.css';
import { dashboardHTML, gameViewHTML } from './dashboard';
import { ChatApp } from './chat';
import { Game, type HudState } from './game/Game';
import { initAuth, requireAuth } from './auth';
import { initInteractions } from './interactions';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = dashboardHTML() + gameViewHTML();

const dashboard = document.querySelector<HTMLDivElement>('#dashboard')!;
const dashMain = document.querySelector<HTMLElement>('.dash-main')!;
const gameView = document.querySelector<HTMLDivElement>('#game-view')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const timerEl = document.querySelector<HTMLDivElement>('#timer')!;
const scoresEl = document.querySelector<HTMLDivElement>('#scores')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const overlayTitle = document.querySelector<HTMLHeadingElement>('#overlay-title')!;
const overlayBody = document.querySelector<HTMLParagraphElement>('#overlay-body')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start-btn')!;
const playNowBtn = document.querySelector<HTMLButtonElement>('#play-now-btn')!;
const modeQuick = document.querySelector<HTMLButtonElement>('#mode-quick')!;
const navPlay = document.querySelector<HTMLAnchorElement>('#nav-play')!;
const backBtn = document.querySelector<HTMLButtonElement>('#back-to-dash')!;
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
const topbarChat = document.querySelector<HTMLButtonElement>('#topbar-chat')!;
const chatRoot = document.querySelector<HTMLElement>('#chat-room')!;

let game: Game | null = null;
let gameBooted = false;
let chatApp: ChatApp | null = null;

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function renderHud(state: HudState): void {
  timerEl.textContent = formatTime(state.timeLeft);
  scoresEl.innerHTML = state.scores
    .map(
      (s) => `
      <div class="score-chip">
        <span class="dot" style="background:${s.color};color:${s.color}"></span>
        <span>${s.name}</span>
        <strong>${s.energy}</strong>
      </div>`,
    )
    .join('');

  if (state.ended) {
    overlay.classList.add('visible');
    overlayTitle.textContent = `${state.winner ?? '???'} WINS`;
    overlayBody.textContent = 'Most energy when the clock hit zero. Rematch?';
    startBtn.textContent = 'PLAY AGAIN';
  }
}

function showDashboard(): void {
  gameView.hidden = true;
  dashboard.hidden = false;
  if (game) game.reset(false);
}

function showGame(): void {
  dashboard.hidden = true;
  gameView.hidden = false;

  if (!gameBooted) {
    game = new Game(canvas, renderHud);
    game.start();
    gameBooted = true;
  }

  overlay.classList.remove('visible');
  game!.reset(true);
}

function ensureChat(): ChatApp {
  if (!chatApp) chatApp = new ChatApp(chatRoot);
  return chatApp;
}

function showChat(): void {
  ensureChat();
  dashboard.classList.add('is-chat');
  dashMain.classList.add('is-chat');
  chatRoot.querySelector<HTMLButtonElement>('.chat-filter[data-filter="all"]')?.click();
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

playNowBtn.addEventListener('click', () => {
  if (!requireAuth()) return;
  showGame();
});
modeQuick.addEventListener('click', () => {
  if (!requireAuth()) return;
  showGame();
});
navPlay.addEventListener('click', (e) => {
  e.preventDefault();
  if (!requireAuth()) return;
  showGame();
});

backBtn.addEventListener('click', showDashboard);

startBtn.addEventListener('click', () => {
  overlay.classList.remove('visible');
  game?.reset(true);
});

topbarChat.addEventListener('click', () => {
  setActiveNav('chat');
  showChat();
});

// Prevent hash nav from jumping
dashboard.querySelectorAll('.dash-nav-item').forEach((el) => {
  el.addEventListener('click', (e) => {
    const nav = (el as HTMLElement).dataset.nav;
    if (nav === 'play') return; // handled above
    e.preventDefault();
    if (nav === 'exit') return;

    setActiveNav(nav ?? 'home');

    if (nav === 'chat') {
      showChat();
      return;
    }

    showHome();

    if (nav === 'ranking') {
      document.querySelector('#section-ranking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      // Lazy-decode non-active slides to ease GPU memory pressure
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
initInteractions({
  showGame: () => {
    if (!requireAuth()) return;
    showGame();
  },
  showChat,
  showHome,
  setActiveNav,
});

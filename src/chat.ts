/** LINK Chat Room — real-time messaging over WebSocket (global lobby + direct messages) */

import { getAuthToken, openAuthModal } from './auth';
import { showToast } from './ui';

export type ChatKind = 'group' | 'dm';

interface Msg {
  id: string;
  mine: boolean;
  author?: string;
  text: string;
  ts: number;
  system?: boolean;
}

interface WirePresence {
  type: 'presence';
  users: { id: string; username: string }[];
}
interface WireWelcome {
  type: 'welcome';
  me: { id: string; username: string };
  users: { id: string; username: string }[];
  history: WireMessage[];
}
interface WireMessage {
  type: 'message';
  id: string;
  from: string;
  fromName: string;
  to: string;
  text: string;
  ts: number;
}
interface WireTyping {
  type: 'typing';
  from: string;
  fromName: string;
  to: string;
}
interface WireHistory {
  type: 'history';
  to: string;
  messages: WireMessage[];
}
type Wire = WirePresence | WireWelcome | WireMessage | WireTyping | WireHistory | { type: 'error'; error: string };

const GLOBAL = 'global';

function ico(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const icons = {
  search: () => ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  emoji: () => ico('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'),
  send: () => ico('<path d="m22 2-7 20-4-9-9-4 20-7z"/>'),
  info: () => ico('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>'),
  close: () => ico('<path d="M6 6l12 12M18 6 6 18"/>'),
  users: () => ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
};

export function chatRoomHTML(): string {
  return `
  <section class="chat-room" id="chat-room" aria-label="LINK Chat Room">
    <!-- LEFT: conversation list -->
    <aside class="chat-list-panel">
      <div class="chat-list-head">
        <div class="chat-search">
          ${icons.search()}
          <input type="search" id="chat-search" placeholder="Search people…" autocomplete="off" />
        </div>
      </div>

      <div class="chat-filters" id="chat-filters" role="tablist">
        <button type="button" class="chat-filter active" data-filter="all">All</button>
        <button type="button" class="chat-filter" data-filter="online">Online</button>
      </div>

      <div class="chat-conv-scroll" id="chat-conv-list" role="list"></div>
    </aside>

    <!-- CENTER: active conversation -->
    <div class="chat-main-panel">
      <header class="chat-thread-head" id="chat-thread-head"></header>
      <div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>
      <div class="chat-typing" id="chat-typing" hidden>
        <span class="chat-typing-dots"><i></i><i></i><i></i></span>
        <span id="chat-typing-label">typing…</span>
      </div>
      <footer class="chat-composer">
        <button type="button" class="chat-tool" id="chat-emoji" title="Emoji">${icons.emoji()}</button>
        <div class="chat-input-wrap">
          <textarea id="chat-input" rows="1" placeholder="Message…" aria-label="Message input"></textarea>
        </div>
        <button type="button" class="chat-send" id="chat-send" title="Send" aria-label="Send">${icons.send()}</button>
      </footer>
      <div class="chat-emoji-panel" id="chat-emoji-panel" hidden>
        ${['😀','🔥','⚡','💜','🎮','🏆','👍','😂','😎','🚀','✨','🎯','💥','🟣','👾','🙌'].map((e) => `<button type="button" class="chat-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
      </div>
    </div>

    <!-- RIGHT: conversation info -->
    <aside class="chat-info-panel" id="chat-info-panel">
      <div class="chat-info-head">
        <h3>Details</h3>
        <button type="button" class="chat-tool" id="chat-info-close" aria-label="Close details">${icons.close()}</button>
      </div>
      <div class="chat-info-body" id="chat-info-body"></div>
    </aside>

    <!-- JOIN GATE: chat only opens after the user joins -->
    <div class="chat-join-gate" id="chat-join-gate" hidden>
      <div class="chat-join-card">
        <div class="chat-join-logo">LINK</div>
        <h3 id="chat-join-title">LINK Chat Room</h3>
        <p id="chat-join-sub">Join the lobby to chat with players who are online right now.</p>
        <button type="button" class="chat-join-btn" id="chat-join-btn">JOIN CHAT ROOM</button>
      </div>
    </div>
  </section>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AVA_COLORS = ['#7c3aed', '#a855f7', '#6d28d9', '#8b5cf6', '#c026d3', '#9333ea', '#7e22ce'];
function avatarFor(name: string): { letter: string; color: string } {
  const letter = (name.trim()[0] || '?').toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { letter, color: AVA_COLORS[h % AVA_COLORS.length] };
}
function avatarHtml(name: string, extra = ''): string {
  const a = avatarFor(name);
  return `<span class="chat-ava ${extra}" style="background:${a.color}">${escapeHtml(a.letter)}</span>`;
}

export class ChatApp {
  private root: HTMLElement;
  private ws: WebSocket | null = null;
  private me: { id: string; username: string } | null = null;
  private online = new Map<string, string>();
  private names = new Map<string, string>();
  private messages = new Map<string, Msg[]>();
  private unread = new Map<string, number>();
  private lastTs = new Map<string, number>();
  private activeId = GLOBAL;
  private filter: 'all' | 'online' = 'all';
  private query = '';
  private infoOpen = true;
  private joined = false;
  private typingTimers = new Map<string, number>();
  private lastTypingSent = 0;
  private reconnectTimer = 0;
  private loadedHistory = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.messages.set(GLOBAL, []);
    this.bind();
    this.render();
    this.renderGate();
  }

  private renderGate(): void {
    const gate = this.el('#chat-join-gate');
    if (this.joined) {
      gate.hidden = true;
      return;
    }
    gate.hidden = false;
    const hasToken = !!getAuthToken();
    const sub = this.el('#chat-join-sub');
    const btn = this.el<HTMLButtonElement>('#chat-join-btn');
    if (hasToken) {
      sub.textContent = 'Join the lobby to chat with players who are online right now.';
      btn.textContent = 'JOIN CHAT ROOM';
    } else {
      sub.textContent = 'Sign in to join the chat and message other players.';
      btn.textContent = 'SIGN IN TO CHAT';
    }
  }

  private join(): void {
    if (!getAuthToken()) {
      openAuthModal('signup');
      return;
    }
    this.joined = true;
    this.el('#chat-join-gate').hidden = true;
    this.connect();
  }

  private el<T extends HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private connect(): void {
    const token = getAuthToken();
    if (!token) {
      this.renderGuest();
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.addEventListener('message', (e) => {
      let data: Wire;
      try {
        data = JSON.parse(e.data as string);
      } catch {
        return;
      }
      this.onWire(data);
    });

    ws.addEventListener('close', () => {
      this.ws = null;
      // Auto-reconnect while the user is still signed in.
      if (getAuthToken()) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
      }
    });

    ws.addEventListener('error', () => ws.close());
  }

  private send(obj: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private onWire(data: Wire): void {
    if (data.type === 'welcome') {
      this.me = data.me;
      this.online = new Map(data.users.map((u) => [u.id, u.username]));
      for (const u of data.users) this.names.set(u.id, u.username);
      this.messages.set(GLOBAL, data.history.map((m) => this.toMsg(m)));
      if (data.history.length) this.lastTs.set(GLOBAL, data.history[data.history.length - 1].ts);
      this.loadedHistory.add(GLOBAL);
      this.render();
    } else if (data.type === 'presence') {
      this.online = new Map(data.users.map((u) => [u.id, u.username]));
      for (const u of data.users) this.names.set(u.id, u.username);
      this.renderList();
      this.renderHead();
      this.renderInfo();
    } else if (data.type === 'message') {
      this.names.set(data.from, data.fromName);
      const convId = this.convIdFor(data);
      const arr = this.messages.get(convId) ?? [];
      if (!arr.some((m) => m.id === data.id)) {
        arr.push(this.toMsg(data));
        this.messages.set(convId, arr);
        this.lastTs.set(convId, data.ts);
      }
      const mine = this.me?.id === data.from;
      if (convId === this.activeId) {
        this.renderMessages();
      } else if (!mine) {
        this.unread.set(convId, (this.unread.get(convId) ?? 0) + 1);
      }
      this.clearTyping(convId);
      this.renderList();
    } else if (data.type === 'typing') {
      const convId = data.to === GLOBAL ? GLOBAL : data.from;
      if (convId === this.activeId) this.showTyping(convId, data.fromName);
    } else if (data.type === 'history') {
      const convId = data.to === GLOBAL ? GLOBAL : data.to;
      this.messages.set(convId, data.messages.map((m) => this.toMsg(m)));
      if (data.messages.length) this.lastTs.set(convId, data.messages[data.messages.length - 1].ts);
      this.loadedHistory.add(convId);
      if (convId === this.activeId) this.renderMessages();
    } else if (data.type === 'error') {
      showToast('Chat unavailable. Please sign in again.');
    }
  }

  private toMsg(m: WireMessage): Msg {
    return {
      id: m.id,
      mine: this.me?.id === m.from,
      author: m.fromName,
      text: m.text,
      ts: m.ts,
    };
  }

  /** Which conversation a wire message belongs to, from this client's perspective. */
  private convIdFor(m: WireMessage): string {
    if (m.to === GLOBAL) return GLOBAL;
    return m.from === this.me?.id ? m.to : m.from;
  }

  private bind(): void {
    this.el('#chat-join-btn').addEventListener('click', () => this.join());

    this.el('#chat-search').addEventListener('input', (e) => {
      this.query = (e.target as HTMLInputElement).value;
      this.renderList();
    });

    this.el('#chat-filters').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-filter');
      if (!btn) return;
      this.filter = btn.dataset.filter as 'all' | 'online';
      this.el('#chat-filters')
        .querySelectorAll('.chat-filter')
        .forEach((b) => b.classList.toggle('active', b === btn));
      this.renderList();
    });

    this.el('#chat-conv-list').addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.chat-conv');
      if (row?.dataset.id) this.select(row.dataset.id);
    });

    this.el('#chat-send').addEventListener('click', () => this.submit());
    const input = this.el<HTMLTextAreaElement>('#chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      }
    });
    input.addEventListener('input', () => {
      this.autoGrow();
      this.emitTyping();
    });

    this.el('#chat-emoji').addEventListener('click', () => {
      const panel = this.el('#chat-emoji-panel');
      panel.hidden = !panel.hidden;
    });
    this.el('#chat-emoji-panel').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-emoji-btn');
      if (!btn) return;
      input.value += btn.dataset.emoji ?? '';
      input.focus();
      this.autoGrow();
    });

    this.el('#chat-info-close').addEventListener('click', () => this.toggleInfo(false));
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#chat-info-toggle')) this.toggleInfo();
      if (!t.closest('#chat-emoji') && !t.closest('#chat-emoji-panel')) this.el('#chat-emoji-panel').hidden = true;
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth < 1100) this.toggleInfo(false);
    });
  }

  private autoGrow(): void {
    const input = this.el<HTMLTextAreaElement>('#chat-input');
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  private emitTyping(): void {
    const now = Date.now();
    if (now - this.lastTypingSent < 1800) return;
    this.lastTypingSent = now;
    this.send({ type: 'typing', to: this.activeId });
  }

  private showTyping(convId: string, who: string): void {
    const el = this.el('#chat-typing');
    const label = this.el('#chat-typing-label');
    el.hidden = false;
    label.textContent = convId === GLOBAL ? `${who} is typing…` : `${who} is typing…`;
    window.clearTimeout(this.typingTimers.get(convId));
    this.typingTimers.set(
      convId,
      window.setTimeout(() => this.clearTyping(convId), 3000),
    );
  }

  private clearTyping(convId: string): void {
    window.clearTimeout(this.typingTimers.get(convId));
    this.typingTimers.delete(convId);
    if (convId === this.activeId) this.el('#chat-typing').hidden = true;
  }

  private select(id: string): void {
    this.activeId = id;
    this.unread.set(id, 0);
    this.root.classList.add('thread-open');
    this.root.classList.remove('list-open');
    this.clearTyping(id);
    if (id !== GLOBAL && !this.loadedHistory.has(id)) {
      this.send({ type: 'history', to: id });
    }
    this.render();
  }

  private submit(): void {
    const input = this.el<HTMLTextAreaElement>('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    this.send({ type: 'message', to: this.activeId, text });
    input.value = '';
    this.autoGrow();
    this.el('#chat-emoji-panel').hidden = true;
  }

  private toggleInfo(force?: boolean): void {
    this.infoOpen = force ?? !this.infoOpen;
    this.root.classList.toggle('info-collapsed', !this.infoOpen);
  }

  /** Build the visible conversation list: Lobby + people (online first, then past DMs). */
  private convList(): { id: string; name: string; kind: ChatKind; online: boolean }[] {
    const list: { id: string; name: string; kind: ChatKind; online: boolean }[] = [
      { id: GLOBAL, name: 'LINK Lobby', kind: 'group', online: true },
    ];
    const seen = new Set<string>([GLOBAL]);
    for (const [id, name] of this.online) {
      if (id === this.me?.id || seen.has(id)) continue;
      seen.add(id);
      list.push({ id, name, kind: 'dm', online: true });
    }
    // Past DMs with people currently offline
    for (const convId of this.messages.keys()) {
      if (seen.has(convId) || convId === GLOBAL) continue;
      seen.add(convId);
      list.push({ id: convId, name: this.names.get(convId) ?? 'Player', kind: 'dm', online: false });
    }

    const q = this.query.trim().toLowerCase();
    return list.filter((c) => {
      if (this.filter === 'online' && !c.online) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private render(): void {
    this.renderList();
    this.renderHead();
    this.renderMessages();
    this.renderInfo();
    const collapse = !this.infoOpen || window.innerWidth < 1100;
    this.root.classList.toggle('info-collapsed', collapse);
  }

  private renderGuest(): void {
    this.el('#chat-conv-list').innerHTML = `<div class="chat-empty-list">Sign in to chat</div>`;
    this.el('#chat-thread-head').innerHTML = '';
    this.el('#chat-messages').innerHTML = `
      <div class="chat-empty-main">
        <h3>Real-time chat</h3>
        <p>Sign up or sign in to chat with players who are online right now.</p>
      </div>`;
    this.el('#chat-info-body').innerHTML = '';
  }

  private lastPreview(convId: string): string {
    const arr = this.messages.get(convId);
    if (!arr || arr.length === 0) return convId === GLOBAL ? 'Say hi to everyone online' : 'No messages yet';
    const m = arr[arr.length - 1];
    return `${m.mine ? 'You: ' : m.author ? `${m.author}: ` : ''}${m.text}`;
  }

  private renderList(): void {
    const list = this.el('#chat-conv-list');
    const items = this.convList().sort((a, b) => {
      if (a.id === GLOBAL) return -1;
      if (b.id === GLOBAL) return 1;
      return (this.lastTs.get(b.id) ?? 0) - (this.lastTs.get(a.id) ?? 0);
    });
    if (items.length === 0) {
      list.innerHTML = `<div class="chat-empty-list">No people found</div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const unread = this.unread.get(c.id) ?? 0;
        const ts = this.lastTs.get(c.id);
        const kindIcon = c.kind === 'group' ? `<span class="chat-kind">${icons.users()}</span>` : '';
        return `
        <button type="button" class="chat-conv${c.id === this.activeId ? ' active' : ''}" data-id="${c.id}" role="listitem">
          <span class="chat-conv-avatar">
            ${avatarHtml(c.name)}
            ${c.online ? '<i class="chat-online"></i>' : ''}
          </span>
          <span class="chat-conv-body">
            <span class="chat-conv-top">
              <span class="chat-conv-name">${kindIcon}${escapeHtml(c.name)}</span>
              <span class="chat-conv-time">${ts ? fmtTime(ts) : ''}</span>
            </span>
            <span class="chat-conv-bottom">
              <span class="chat-conv-preview">${escapeHtml(this.lastPreview(c.id))}</span>
              <span class="chat-conv-flags">
                ${unread > 0 ? `<span class="chat-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
              </span>
            </span>
          </span>
        </button>`;
      })
      .join('');
  }

  private activeMeta(): { name: string; kind: ChatKind; online: boolean; status: string } {
    if (this.activeId === GLOBAL) {
      const count = this.online.size;
      return { name: 'LINK Lobby', kind: 'group', online: true, status: `${count} online` };
    }
    const online = this.online.has(this.activeId);
    return {
      name: this.names.get(this.activeId) ?? 'Player',
      kind: 'dm',
      online,
      status: online ? 'Online' : 'Offline',
    };
  }

  private renderHead(): void {
    if (!this.me) return;
    const c = this.activeMeta();
    this.el('#chat-thread-head').innerHTML = `
      <div class="chat-thread-user">
        <button type="button" class="chat-back-mobile" id="chat-back-list" aria-label="Back to conversations">←</button>
        <span class="chat-conv-avatar lg">
          ${avatarHtml(c.name, 'lg')}
          ${c.online ? '<i class="chat-online"></i>' : ''}
        </span>
        <div>
          <div class="chat-thread-name">${escapeHtml(c.name)}</div>
          <div class="chat-thread-status">${escapeHtml(c.status)}</div>
        </div>
      </div>
      <div class="chat-thread-actions">
        <button type="button" class="chat-tool" id="chat-info-toggle" title="Details">${icons.info()}</button>
      </div>
    `;
    this.el('#chat-back-list')?.addEventListener('click', () => {
      this.root.classList.remove('thread-open');
      this.root.classList.add('list-open');
    });
  }

  private renderMessages(): void {
    if (!this.me) {
      this.renderGuest();
      return;
    }
    const box = this.el('#chat-messages');
    const arr = this.messages.get(this.activeId) ?? [];
    const parts: string[] = ['<div class="chat-msg-spacer"></div>'];
    if (arr.length === 0) {
      parts.push(
        `<div class="chat-empty-main"><h3>${escapeHtml(this.activeMeta().name)}</h3><p>${
          this.activeId === GLOBAL
            ? 'This is the global lobby. Messages are shared with everyone online.'
            : 'No messages yet. Say hello!'
        }</p></div>`,
      );
    } else {
      parts.push('<div class="chat-day"><span>Today</span></div>');
      for (const m of arr) {
        if (m.system) {
          parts.push(`<div class="chat-system">${escapeHtml(m.text)}</div>`);
          continue;
        }
        const showAuthor = this.activeId === GLOBAL && !m.mine;
        parts.push(`
          <article class="chat-bubble ${m.mine ? 'mine' : 'theirs'}" data-id="${m.id}">
            ${showAuthor ? `<div class="chat-author">${escapeHtml(m.author ?? 'Player')}</div>` : ''}
            <div class="chat-bubble-body"><p>${escapeHtml(m.text)}</p></div>
            <div class="chat-meta"><span>${fmtTime(m.ts)}</span></div>
          </article>`);
      }
    }
    box.innerHTML = parts.join('');
    box.scrollTop = box.scrollHeight;
  }

  private renderInfo(): void {
    if (!this.me) return;
    const c = this.activeMeta();
    if (this.activeId === GLOBAL) {
      const members = [...this.online.entries()]
        .map(
          ([id, name]) =>
            `<li>${avatarHtml(name)} ${escapeHtml(name)} <span>${id === this.me?.id ? 'You' : 'Online'}</span></li>`,
        )
        .join('');
      this.el('#chat-info-body').innerHTML = `
        <div class="chat-info-profile">
          ${avatarHtml(c.name, 'xl')}
          <h4>${escapeHtml(c.name)}</h4>
          <p>${escapeHtml(c.status)}</p>
        </div>
        <div class="chat-members">
          <h5>${icons.users()} Online now · ${this.online.size}</h5>
          <ul>${members || '<li>No one else is online</li>'}</ul>
        </div>`;
    } else {
      this.el('#chat-info-body').innerHTML = `
        <div class="chat-info-profile">
          ${avatarHtml(c.name, 'xl')}
          <h4>${escapeHtml(c.name)}</h4>
          <p>${escapeHtml(c.status)}</p>
        </div>
        <div class="chat-about">
          <h5>Direct message</h5>
          <p>Messages are delivered in real time while ${escapeHtml(c.name)} is online.</p>
        </div>`;
    }
  }
}

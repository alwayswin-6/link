/** LINK Chat Room — real-time messaging over WebSocket (lobby, DMs, groups, media, voice) */

import { getAuthToken, openAuthModal } from './auth';
import { showToast } from './ui';
import { VoiceRoom, voiceRoomKey } from './voice';
import {
  memberNameplateRow,
  type MediaItem,
} from './cosmetics';
import { BUILTIN_STICKERS, BUILTIN_GIFS } from './builtin-media';

export type ChatKind = 'group' | 'dm';
export type Delivery = 'sending' | 'sent' | 'delivered';

interface Msg {
  id: string;
  clientId?: string;
  from?: string;
  mine: boolean;
  author?: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  stickerUrl?: string;
  gifUrl?: string;
  durationMs?: number;
  replyTo?: { id: string; text: string; fromName: string };
  ts: number;
  system?: boolean;
  delivery?: Delivery;
}

interface DirUser {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
}

interface WirePresence {
  type: 'presence';
  users: { id: string; username: string }[];
}
interface WireWelcome {
  type: 'welcome';
  me: { id: string; username: string; avatarUrl?: string };
  users: { id: string; username: string }[];
  directory?: DirUser[];
  groups?: GroupInfo[];
  history: WireMessage[];
}
interface WireMessage {
  type: 'message';
  id: string;
  clientId?: string;
  from: string;
  fromName: string;
  to: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  stickerUrl?: string;
  gifUrl?: string;
  durationMs?: number;
  replyTo?: { id: string; text: string; fromName: string };
  ts: number;
}
interface WireAck {
  type: 'message_ack';
  clientId?: string;
  id: string;
  ts: number;
  to: string;
}
interface WireReceipt {
  type: 'receipt';
  id: string;
  status: 'delivered';
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
interface WireGroupCreated {
  type: 'group_created';
  group: GroupInfo;
}
interface WireSearchResults {
  type: 'search_results';
  query: string;
  people: { id: string; name: string; kind: 'dm'; online: boolean; avatarUrl?: string }[];
  groups: { id: string; name: string; kind: 'group'; online: boolean; members: number; joined?: boolean }[];
}
interface WireVoice {
  type: 'voice_peers' | 'voice_peer_joined' | 'voice_peer_left' | 'voice_state' | 'voice_signal';
  room?: string;
  peers?: { id: string; username: string; muted: boolean; deafened: boolean }[];
  peer?: { id: string; username: string; muted: boolean; deafened: boolean };
  from?: string;
  fromName?: string;
  payload?: import('./voice').VoiceSignalPayload;
  muted?: boolean;
  deafened?: boolean;
}
type Wire =
  | WirePresence
  | WireWelcome
  | WireMessage
  | WireAck
  | WireReceipt
  | WireTyping
  | WireHistory
  | WireGroupCreated
  | WireSearchResults
  | WireVoice
  | { type: 'error'; error: string };

const GLOBAL = 'global';

const EMOJIS = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗',
  '😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐',
  '😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑',
  '😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰',
  '😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','🥴','😇',
  '🥳','🥺','🤠','🤡','🤥','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','👻','👽',
  '🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👋','🤚','🖐','✋','🖖',
  '👌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊',
  '🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','👃','🧠',
  '👀','👁️','👅','👄','💋','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️',
  '🧡','💛','💚','💙','💜','🖤','🤍','🤎','💯','💢','💥','💫','💦','💨','🕳️','💣',
  '💬','👁️‍🗨️','🗨️','🗯️','💭','💤','🔥','⭐','🌟','✨','⚡','☄️','💥','🌈','☀️','🌤️',
  '⛅','🌍','🌎','🌏','🌐','🗺️','🧭','🎮','🕹️','👾','🎯','🎲','♟️','🃏','🀄','🎴',
  '🏆','🏅','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🪀','🏓',
  '🚀','✈️','🛸','🚁','🛶','⛵','🚢','🚗','🚕','🚌','🏎️','🚓','🚑','🚒','🚲','🛴',
  '🏁','🚩','🎌','🏴','🏳️','🎵','🎶','🎤','🎧','🎷','🎸','🎹','🎺','🎻','🥁','🎬',
  '🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥨','🥯',
  '☕','🍵','🧃','🥤','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🧊','🎂','🍰','🧁',
];

function ico(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const icons = {
  search: () => ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  emoji: () => ico('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'),
  send: () => ico('<path d="m22 2-7 20-4-9-9-4 20-7z"/>'),
  info: () => ico('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>'),
  close: () => ico('<path d="M6 6l12 12M18 6 6 18"/>'),
  users: () =>
    ico(
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    ),
  image: () =>
    ico('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  plus: () => ico('<path d="M12 5v14M5 12h14"/>'),
  mic: () =>
    ico('<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8"/>'),
  voice: () =>
    ico(
      '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6"/>',
    ),
  mute: () =>
    ico(
      '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8"/><path d="M4 4l16 16"/>',
    ),
  deafen: () =>
    ico(
      '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M5 14a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1"/><path d="M19 14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"/><path d="M4 4l16 16"/>',
    ),
  headphones: () =>
    ico(
      '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M5 14a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v-6H5z"/><path d="M19 14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v-6h1z"/>',
    ),
  phoneOff: () =>
    ico('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><path d="M23 1 1 23"/>'),
};

function newClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function fmtDuration(ms = 0): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function deliveryTicks(d?: Delivery): string {
  if (d === 'delivered') return `<span class="chat-ticks is-delivered" title="Delivered">✓✓</span>`;
  if (d === 'sent') return `<span class="chat-ticks is-sent" title="Sent">✓</span>`;
  return `<span class="chat-ticks is-sending" title="Sending">…</span>`;
}

function isGroupId(id: string): boolean {
  return id.startsWith('group:');
}

export function chatRoomHTML(): string {
  return `
  <section class="chat-room" id="chat-room" aria-label="LINK Chat Room">
    <aside class="chat-list-panel">
      <div class="chat-list-head">
        <div class="chat-search">
          ${icons.search()}
          <input type="search" id="chat-search" placeholder="Search people & groups…" autocomplete="off" />
        </div>
        <button type="button" class="chat-new-btn" id="chat-new-group" title="New group">${icons.plus()}</button>
      </div>

      <div class="chat-filters" id="chat-filters" role="tablist">
        <button type="button" class="chat-filter active" data-filter="all">All</button>
        <button type="button" class="chat-filter" data-filter="online">Online</button>
        <button type="button" class="chat-filter" data-filter="groups">Groups</button>
      </div>

      <div class="chat-conv-scroll" id="chat-conv-list" role="list"></div>
    </aside>

    <div class="chat-main-panel">
      <header class="chat-thread-head" id="chat-thread-head"></header>
      <div class="chat-voice-dock" id="chat-voice-dock" hidden></div>
      <div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>
      <div class="chat-typing" id="chat-typing" hidden>
        <span class="chat-typing-dots"><i></i><i></i><i></i></span>
        <span id="chat-typing-label">typing…</span>
      </div>
      <footer class="chat-composer">
        <div class="chat-reply-bar" id="chat-reply-bar" hidden>
          <div class="chat-reply-bar-body">
            <span class="chat-reply-bar-label">Replying to <strong id="chat-reply-name"></strong></span>
            <span class="chat-reply-bar-text" id="chat-reply-snip"></span>
          </div>
          <button type="button" class="chat-tool" id="chat-reply-cancel" title="Cancel reply">${icons.close()}</button>
        </div>
        <div class="chat-composer-row">
          <button type="button" class="chat-tool" id="chat-emoji" title="Emoji & stickers">${icons.emoji()}</button>
          <button type="button" class="chat-tool" id="chat-image" title="Send image">${icons.image()}</button>
          <button type="button" class="chat-tool chat-mic" id="chat-voice-msg" title="Record voice message">${icons.mic()}</button>
          <input type="file" id="chat-image-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
          <div class="chat-input-wrap">
            <textarea id="chat-input" rows="1" placeholder="Message…" aria-label="Message input"></textarea>
          </div>
          <button type="button" class="chat-send" id="chat-send" title="Send" aria-label="Send">${icons.send()}</button>
        </div>
      </footer>
      <div class="chat-emoji-panel" id="chat-emoji-panel" hidden>
        <div class="chat-media-tabs" id="chat-media-tabs">
          <button type="button" class="chat-media-tab active" data-media-tab="emoji">Emoji</button>
          <button type="button" class="chat-media-tab" data-media-tab="sticker">Stickers</button>
          <button type="button" class="chat-media-tab" data-media-tab="gif">GIFs</button>
        </div>
        <div class="chat-media-pane" id="chat-media-emoji">
          ${EMOJIS.map((e) => `<button type="button" class="chat-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
        </div>
        <div class="chat-media-pane" id="chat-media-sticker" hidden></div>
        <div class="chat-media-pane" id="chat-media-gif" hidden></div>
      </div>
    </div>

    <aside class="chat-info-panel" id="chat-info-panel">
      <div class="chat-info-head">
        <h3>Details</h3>
        <button type="button" class="chat-tool" id="chat-info-close" aria-label="Close details">${icons.close()}</button>
      </div>
      <div class="chat-info-body" id="chat-info-body"></div>
    </aside>

    <div class="chat-join-gate" id="chat-join-gate" hidden>
      <div class="chat-join-card">
        <div class="chat-join-logo"><img src="/position/logo.png" alt="" /><span>LINK</span></div>
        <h3 id="chat-join-title">LINK Chat Room</h3>
        <p id="chat-join-sub">Join the lobby to chat with players who are online right now.</p>
        <button type="button" class="chat-join-btn" id="chat-join-btn">JOIN CHAT ROOM</button>
      </div>
    </div>

    <div class="chat-modal" id="chat-group-modal" hidden>
      <div class="chat-modal-card">
        <div class="chat-modal-head">
          <h3>New group</h3>
          <button type="button" class="chat-tool" id="chat-group-close" aria-label="Close">${icons.close()}</button>
        </div>
        <label class="chat-field">
          <span>Group name</span>
          <input type="text" id="chat-group-name" maxlength="40" placeholder="Squad name" />
        </label>
        <label class="chat-field">
          <span>Add members</span>
          <input type="search" id="chat-group-member-search" placeholder="Search players…" />
        </label>
        <div class="chat-member-picks" id="chat-group-members"></div>
        <button type="button" class="chat-join-btn" id="chat-group-create">CREATE GROUP</button>
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

const AVA_COLORS = ['#2F9E5F', '#247A4A', '#3DB870', '#1B5E3B', '#4A8F62', '#2A6B45', '#6BC48A'];
function avatarFor(name: string): { letter: string; color: string } {
  const letter = (name.trim()[0] || '?').toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { letter, color: AVA_COLORS[h % AVA_COLORS.length] };
}
function avatarHtml(name: string, extra = '', avatarUrl = ''): string {
  if (avatarUrl) {
    return `<img class="chat-ava-img ${extra}" src="${escapeHtml(avatarUrl)}" alt="" />`;
  }
  const a = avatarFor(name);
  return `<span class="chat-ava ${extra}" style="background:${a.color}">${escapeHtml(a.letter)}</span>`;
}

function statusDot(online: boolean): string {
  return `<i class="chat-status ${online ? 'is-online' : 'is-offline'}" aria-hidden="true"></i>`;
}

export class ChatApp {
  private root: HTMLElement;
  private ws: WebSocket | null = null;
  private me: { id: string; username: string; avatarUrl?: string } | null = null;
  private online = new Map<string, string>();
  private names = new Map<string, string>();
  private avatars = new Map<string, string>();
  private directory = new Map<string, DirUser>();
  private groups = new Map<string, GroupInfo>();
  private messages = new Map<string, Msg[]>();
  private unread = new Map<string, number>();
  private lastTs = new Map<string, number>();
  private activeId = GLOBAL;
  private filter: 'all' | 'online' | 'groups' = 'all';
  private query = '';
  private searchPeople: WireSearchResults['people'] = [];
  private searchGroups: WireSearchResults['groups'] = [];
  private searchTimer = 0;
  private infoOpen = typeof window !== 'undefined' ? window.innerWidth >= 1100 : true;
  private infoUserId: string | null = null;
  private replyTo: { id: string; text: string; fromName: string } | null = null;
  private cosmeticsCache = new Map<string, { nameplateUrl?: string }>();
  private mediaStickers: MediaItem[] = [];
  private mediaGifs: MediaItem[] = [];
  private mediaTab: 'emoji' | 'sticker' | 'gif' = 'emoji';
  private joined = false;
  private typingTimers = new Map<string, number>();
  private lastTypingSent = 0;
  private reconnectTimer = 0;
  private loadedHistory = new Set<string>();
  private pendingMembers = new Set<string>();
  private mediaRecorder: MediaRecorder | null = null;
  private recordChunks: Blob[] = [];
  private recordStarted = 0;
  private recordTimer = 0;
  private voiceRecording = false;
  private pendingVoice: { blob: Blob; durationMs: number; mime: string } | null = null;
  private syncViewport: (() => void) | null = null;
  private voice = new VoiceRoom(
    (obj) => this.send(obj),
    () => {
      this.renderHead();
      this.renderVoiceDock();
    },
  );

  constructor(root: HTMLElement) {
    this.root = root;
    this.messages.set(GLOBAL, []);
    this.bind();
    this.renderGate();
    this.render();
  }

  private renderGate(): void {
    const gate = this.el('#chat-join-gate');
    this.root.classList.toggle('is-gated', !this.joined);
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
    this.renderGate();
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
      if (getAuthToken() && this.joined) {
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
      this.voice.setIdentity(data.me.id, data.me.username);
      this.online = new Map(data.users.map((u) => [u.id, u.username]));
      for (const u of data.users) this.names.set(u.id, u.username);
      this.directory.clear();
      for (const u of data.directory ?? []) {
        this.directory.set(u.id, u);
        this.names.set(u.id, u.username);
        if (u.avatarUrl) this.avatars.set(u.id, u.avatarUrl);
      }
      this.groups.clear();
      for (const g of data.groups ?? []) {
        this.groups.set(g.id, g);
        this.names.set(g.id, g.name);
        if (!this.messages.has(g.id)) this.messages.set(g.id, []);
      }
      // Transcripts come from the server archive — never localStorage.
      this.messages.set(GLOBAL, data.history.map((m) => this.toMsg(m)));
      if (data.history.length) this.lastTs.set(GLOBAL, data.history[data.history.length - 1].ts);
      this.loadedHistory.clear();
      this.loadedHistory.add(GLOBAL);
      if (this.activeId !== GLOBAL) {
        this.send({ type: 'history', to: this.activeId });
      }
      this.render();
    } else if (data.type === 'presence') {
      this.online = new Map(data.users.map((u) => [u.id, u.username]));
      for (const u of data.users) this.names.set(u.id, u.username);
      this.renderList();
      this.patchHeadStatus();
      // Avoid full Details rebuild on every presence pulse (major flicker source).
      if (this.infoOpen) this.patchInfoPresence();
    } else if (data.type === 'message') {
      this.names.set(data.from, data.fromName);
      const convId = this.convIdFor(data);
      const arr = this.messages.get(convId) ?? [];
      const mine = this.me?.id === data.from;
      const byClient =
        mine && data.clientId ? arr.findIndex((m) => m.clientId === data.clientId || m.id === data.clientId) : -1;
      let updated: Msg | null = null;
      if (byClient >= 0) {
        arr[byClient] = {
          ...arr[byClient],
          id: data.id,
          from: data.from,
          delivery: arr[byClient].delivery === 'delivered' ? 'delivered' : 'sent',
          text: data.text || arr[byClient].text,
          imageUrl: data.imageUrl ?? arr[byClient].imageUrl,
          audioUrl: data.audioUrl ?? arr[byClient].audioUrl,
          stickerUrl: data.stickerUrl ?? arr[byClient].stickerUrl,
          gifUrl: data.gifUrl ?? arr[byClient].gifUrl,
          replyTo: data.replyTo ?? arr[byClient].replyTo,
          durationMs: data.durationMs ?? arr[byClient].durationMs,
          ts: data.ts,
        };
        updated = arr[byClient];
      } else if (!arr.some((m) => m.id === data.id)) {
        updated = this.toMsg(data, mine ? 'sent' : undefined);
        arr.push(updated);
      }
      this.messages.set(convId, arr);
      this.lastTs.set(convId, data.ts);
      if (convId === this.activeId && updated) {
        if (byClient >= 0) this.patchBubble(updated);
        else this.appendBubble(updated, true);
      } else if (!mine) this.unread.set(convId, (this.unread.get(convId) ?? 0) + 1);
      this.clearTyping(convId);
      this.patchConvPreview(convId);
      if (!mine) this.send({ type: 'receipt', id: data.id, status: 'delivered' });
    } else if (data.type === 'message_ack') {
      let found = false;
      const tryUpdate = (convId: string) => {
        const arr = this.messages.get(convId) ?? [];
        const idx = arr.findIndex(
          (m) => m.id === data.clientId || m.clientId === data.clientId || m.id === data.id,
        );
        if (idx < 0) return false;
        arr[idx] = {
          ...arr[idx],
          id: data.id,
          clientId: data.clientId || arr[idx].clientId,
          delivery: arr[idx].delivery === 'delivered' ? 'delivered' : 'sent',
          ts: data.ts || arr[idx].ts,
        };
        this.messages.set(convId, arr);
        if (convId === this.activeId) this.patchBubble(arr[idx]);
        return true;
      };
      const preferred =
        data.to === GLOBAL || isGroupId(data.to) ? data.to : this.me?.id === data.to ? this.activeId : data.to;
      found = tryUpdate(preferred) || tryUpdate(this.activeId);
      if (!found) {
        for (const convId of this.messages.keys()) {
          if (tryUpdate(convId)) {
            found = true;
            break;
          }
        }
      }
      if (found) {
        /* ack only updates ticks — no sidebar rebuild */
      }
    } else if (data.type === 'receipt') {
      for (const [convId, arr] of this.messages) {
        const idx = arr.findIndex((m) => m.id === data.id && m.mine);
        if (idx < 0) continue;
        arr[idx] = { ...arr[idx], delivery: 'delivered' };
        this.messages.set(convId, arr);
        if (convId === this.activeId) this.patchBubble(arr[idx]);
        break;
      }
    } else if (data.type === 'typing') {
      let convId = data.to;
      if (data.to !== GLOBAL && !isGroupId(data.to)) convId = data.from;
      if (convId === this.activeId) this.showTyping(convId, data.fromName);
    } else if (data.type === 'history') {
      const convId = data.to;
      this.messages.set(convId, data.messages.map((m) => this.toMsg(m)));
      if (data.messages.length) this.lastTs.set(convId, data.messages[data.messages.length - 1].ts);
      this.loadedHistory.add(convId);
      if (convId === this.activeId) this.renderMessages();
    } else if (data.type === 'group_created') {
      this.groups.set(data.group.id, data.group);
      this.names.set(data.group.id, data.group.name);
      if (!this.messages.has(data.group.id)) this.messages.set(data.group.id, []);
      for (const mid of data.group.members) {
        if (!this.names.has(mid)) {
          const dir = this.directory.get(mid);
          if (dir) this.names.set(mid, dir.username);
        }
      }
      if (data.group.createdBy && !this.names.has(data.group.createdBy)) {
        const dir = this.directory.get(data.group.createdBy);
        if (dir) this.names.set(data.group.createdBy, dir.username);
        else if (data.group.createdBy === this.me?.id && this.me) {
          this.names.set(data.group.createdBy, this.me.username);
        }
      }
      this.renderList();
      this.renderInfo();
      if (data.group.createdBy === this.me?.id) {
        this.select(data.group.id);
        showToast(`Group “${data.group.name}” ready`);
      } else if (this.activeId === data.group.id && !this.loadedHistory.has(data.group.id)) {
        this.send({ type: 'history', to: data.group.id });
      }
    } else if (data.type === 'search_results') {
      this.searchPeople = data.people;
      this.searchGroups = data.groups;
      this.renderList();
    } else if (data.type === 'error') {
      const err = data.error;
      if (err === 'unauthorized') showToast('Chat unavailable. Please sign in again.');
      else if (err === 'muted') showToast('You are muted and cannot send messages.');
      else if (err === 'account_restricted') showToast('Account restricted.');
      else showToast('Chat error');
    } else if (
      data.type === 'voice_peers' ||
      data.type === 'voice_peer_joined' ||
      data.type === 'voice_peer_left' ||
      data.type === 'voice_state' ||
      data.type === 'voice_signal'
    ) {
      this.voice.handleWire(data as Parameters<VoiceRoom['handleWire']>[0]);
    }
  }

  private toMsg(m: WireMessage, delivery?: Delivery): Msg {
    return {
      id: m.id,
      clientId: m.clientId,
      from: m.from,
      mine: this.me?.id === m.from,
      author: m.fromName,
      text: m.text || '',
      imageUrl: m.imageUrl,
      audioUrl: m.audioUrl,
      stickerUrl: m.stickerUrl,
      gifUrl: m.gifUrl,
      durationMs: m.durationMs,
      replyTo: m.replyTo,
      ts: m.ts,
      delivery: this.me?.id === m.from ? delivery || 'delivered' : undefined,
    };
  }

  private convIdFor(m: WireMessage): string {
    if (m.to === GLOBAL || isGroupId(m.to)) return m.to;
    return m.from === this.me?.id ? m.to : m.from;
  }

  private bind(): void {
    this.el('#chat-join-btn').addEventListener('click', () => this.join());

    document.addEventListener('link:auth-changed', () => {
      if (!getAuthToken()) {
        void this.voice.leave();
        this.joined = false;
        this.me = null;
        this.ws?.close();
        this.ws = null;
      }
      this.renderGate();
      if (!this.joined) this.renderGuest();
      else this.render();
    });

    document.addEventListener('link:cosmetics-changed', () => {
      if (this.me?.id) this.cosmeticsCache.delete(this.me.id);
      if (this.infoOpen) this.renderInfo();
    });

    this.el('#chat-search').addEventListener('input', (e) => {
      this.query = (e.target as HTMLInputElement).value;
      window.clearTimeout(this.searchTimer);
      if (this.query.trim()) {
        this.searchTimer = window.setTimeout(() => {
          this.send({ type: 'search', query: this.query.trim() });
        }, 180);
      } else {
        this.searchPeople = [];
        this.searchGroups = [];
        this.renderList();
      }
      this.renderList();
    });

    this.el('#chat-filters').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-filter');
      if (!btn) return;
      this.filter = btn.dataset.filter as 'all' | 'online' | 'groups';
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
      if (!panel.hidden) void this.ensureMediaPack();
    });
    this.el('#chat-media-tabs')?.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-media-tab]');
      if (!tab?.dataset.mediaTab) return;
      this.mediaTab = tab.dataset.mediaTab as 'emoji' | 'sticker' | 'gif';
      this.root.querySelectorAll('.chat-media-tab').forEach((b) => {
        b.classList.toggle('active', b === tab);
      });
      this.el('#chat-media-emoji').hidden = this.mediaTab !== 'emoji';
      this.el('#chat-media-sticker').hidden = this.mediaTab !== 'sticker';
      this.el('#chat-media-gif').hidden = this.mediaTab !== 'gif';
    });
    this.el('#chat-emoji-panel').addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const emojiBtn = t.closest<HTMLButtonElement>('.chat-emoji-btn');
      if (emojiBtn) {
        input.value += emojiBtn.dataset.emoji ?? '';
        input.focus();
        this.autoGrow();
        return;
      }
      const mediaBtn = t.closest<HTMLButtonElement>('[data-media-url]');
      if (mediaBtn?.dataset.mediaUrl) {
        const kind = mediaBtn.dataset.mediaKind || 'sticker';
        void this.sendMediaChip(kind === 'gif' ? 'gif' : 'sticker', mediaBtn.dataset.mediaUrl);
      }
    });

    this.el('#chat-reply-cancel')?.addEventListener('click', () => this.clearReply());

    this.el('#chat-image').addEventListener('click', () => this.el<HTMLInputElement>('#chat-image-input').click());
    this.el('#chat-image-input').addEventListener('change', async () => {
      const file = this.el<HTMLInputElement>('#chat-image-input').files?.[0];
      this.el<HTMLInputElement>('#chat-image-input').value = '';
      if (file) await this.sendImage(file);
    });

    const mic = this.el('#chat-voice-msg');
    mic.addEventListener('click', (e) => {
      e.preventDefault();
      void this.toggleVoiceMessage();
    });

    this.el('#chat-info-close').addEventListener('click', () => {
      if (this.infoUserId) {
        this.infoUserId = null;
        this.renderInfo();
        return;
      }
      this.toggleInfo(false);
    });
    this.el('#chat-info-body').addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-user-id]');
      if (row?.dataset.userId) {
        this.infoUserId = row.dataset.userId;
        void this.renderInfo();
        return;
      }
      if ((e.target as HTMLElement).closest('#chat-info-back-members')) {
        this.infoUserId = null;
        this.renderInfo();
      }
      if ((e.target as HTMLElement).closest('#chat-info-dm')) {
        const id = this.infoUserId;
        if (id && id !== this.me?.id) {
          this.infoUserId = null;
          this.select(id);
        }
      }
    });
    this.el('#chat-messages').addEventListener('click', (e) => {
      const replyBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-reply-id]');
      if (!replyBtn?.dataset.replyId) return;
      const id = replyBtn.dataset.replyId;
      const arr = this.messages.get(this.activeId) ?? [];
      const msg = arr.find((m) => m.id === id);
      if (!msg) return;
      this.setReply({
        id: msg.id,
        text: msg.text || (msg.stickerUrl || msg.gifUrl || msg.imageUrl ? 'Attachment' : ''),
        fromName: msg.author || (msg.mine ? this.me?.username || 'You' : 'Player'),
      });
    });
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      // Dimmed overlay (::after) — target is the room root itself
      if (t === this.root && this.infoOpen) {
        this.toggleInfo(false);
        return;
      }
      if (t.closest('#chat-info-toggle')) this.toggleInfo();
      if (t.closest('#chat-voice-call')) void this.toggleVoice();
      if (t.closest('#chat-voice-mute')) this.voice.toggleMute();
      if (t.closest('#chat-voice-deafen')) this.voice.toggleDeafen();
      if (t.closest('#chat-voice-leave')) void this.voice.leave();
      if (t.closest('#chat-voice-cancel')) this.cancelPendingVoice();
      if (!t.closest('#chat-emoji') && !t.closest('#chat-emoji-panel')) this.el('#chat-emoji-panel').hidden = true;
    });

    this.bindViewport();

    this.el('#chat-new-group').addEventListener('click', () => this.openGroupModal(true));
    this.el('#chat-group-close').addEventListener('click', () => this.openGroupModal(false));
    this.el('#chat-group-modal').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'chat-group-modal') this.openGroupModal(false);
    });
    this.el('#chat-group-member-search').addEventListener('input', () => this.renderMemberPicks());
    this.el('#chat-group-members').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-member]');
      if (!btn?.dataset.member) return;
      const id = btn.dataset.member;
      if (this.pendingMembers.has(id)) this.pendingMembers.delete(id);
      else this.pendingMembers.add(id);
      this.renderMemberPicks();
    });
    this.el('#chat-group-create').addEventListener('click', () => this.createGroup());

    window.addEventListener('resize', () => {
      if (window.innerWidth < 1100) this.toggleInfo(false);
    });
  }

  private async toggleVoice(): Promise<void> {
    if (!this.me) {
      openAuthModal('signup');
      return;
    }
    if (this.activeId === GLOBAL || isGroupId(this.activeId)) {
      showToast('Voice is only available in 1:1 chats');
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    if (this.voice.connected) {
      await this.voice.leave();
      showToast('Left voice channel');
      return;
    }
    try {
      const room = voiceRoomKey(this.activeId, this.me.id);
      await this.voice.join(room);
      showToast('Joined voice channel');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not join voice');
    }
  }

  private renderVoiceDock(): void {
    const dock = this.el('#chat-voice-dock');
    if (!this.voice.connected || !this.me) {
      dock.hidden = true;
      dock.innerHTML = '';
      return;
    }
    dock.hidden = false;
    const peers = [...this.voice.peers.values()];
    const self = {
      id: this.me.id,
      username: this.me.username,
      muted: this.voice.muted,
      deafened: this.voice.deafened,
    };
    const all = [self, ...peers];
    dock.innerHTML = `
      <div class="chat-voice-dock-top">
        <div class="chat-voice-live">
          <span class="chat-voice-pulse" aria-hidden="true"></span>
          Voice Connected · ${all.length}
        </div>
        <div class="chat-voice-controls">
          <button type="button" class="chat-voice-ctrl${this.voice.muted ? ' is-off' : ''}" id="chat-voice-mute" title="${this.voice.muted ? 'Unmute' : 'Mute'}">
            ${this.voice.muted ? icons.mute() : icons.mic()}
          </button>
          <button type="button" class="chat-voice-ctrl${this.voice.deafened ? ' is-off' : ''}" id="chat-voice-deafen" title="${this.voice.deafened ? 'Undeafen' : 'Deafen'}">
            ${this.voice.deafened ? icons.deafen() : icons.headphones()}
          </button>
          <button type="button" class="chat-voice-ctrl is-leave" id="chat-voice-leave" title="Disconnect">${icons.phoneOff()}</button>
        </div>
      </div>
      <div class="chat-voice-people">
        ${all
          .map((p) => {
            const you = p.id === this.me?.id;
            const flags = [
              you ? 'You' : '',
              p.muted ? 'Muted' : '',
              p.deafened ? 'Deafened' : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return `<div class="chat-voice-person${p.muted ? ' is-muted' : ''}">
              <span class="chat-conv-avatar sm">${avatarHtml(p.username, '', you ? this.me?.avatarUrl || '' : this.avatars.get(p.id) || '')}</span>
              <span class="chat-voice-person-meta">
                <strong>${escapeHtml(p.username)}</strong>
                ${flags ? `<small>${escapeHtml(flags)}</small>` : '<small>Speaking channel</small>'}
              </span>
            </div>`;
          })
          .join('')}
      </div>`;
  }

  private openGroupModal(show: boolean): void {
    const modal = this.el('#chat-group-modal');
    modal.hidden = !show;
    if (show) {
      this.pendingMembers.clear();
      this.el<HTMLInputElement>('#chat-group-name').value = '';
      this.el<HTMLInputElement>('#chat-group-member-search').value = '';
      this.renderMemberPicks();
      this.el<HTMLInputElement>('#chat-group-name').focus();
    }
  }

  private renderMemberPicks(): void {
    const q = this.el<HTMLInputElement>('#chat-group-member-search').value.trim().toLowerCase();
    const people = [...this.directory.values()]
      .filter((u) => u.id !== this.me?.id && (!q || u.username.toLowerCase().includes(q)))
      .slice(0, 40);
    const box = this.el('#chat-group-members');
    if (!people.length) {
      box.innerHTML = `<div class="chat-empty-list">No players found</div>`;
      return;
    }
    box.innerHTML = people
      .map((u) => {
        const on = this.pendingMembers.has(u.id);
        const live = this.online.has(u.id);
        return `<button type="button" class="chat-member-pick${on ? ' on' : ''}" data-member="${u.id}">
          <span class="chat-conv-avatar sm">${avatarHtml(u.username, '', u.avatarUrl || '')}${statusDot(live)}</span>
          <span>${escapeHtml(u.username)}</span>
          <span class="chat-pick-check">${on ? '✓' : '+'}</span>
        </button>`;
      })
      .join('');
  }

  private createGroup(): void {
    const name = this.el<HTMLInputElement>('#chat-group-name').value.trim();
    if (name.length < 2) {
      showToast('Enter a group name');
      return;
    }
    this.send({ type: 'create_group', name, members: [...this.pendingMembers] });
    this.openGroupModal(false);
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
    label.textContent = `${who} is typing…`;
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
    this.infoUserId = null;
    this.clearReply();
    this.root.classList.add('thread-open');
    this.root.classList.remove('list-open');
    this.clearTyping(id);
    if (window.innerWidth < 860) this.toggleInfo(false);
    if (id === GLOBAL || isGroupId(id)) {
      if (this.voice.connected) void this.voice.leave();
    }
    if (isGroupId(id) && !this.groups.has(id)) {
      this.send({ type: 'join_group', id });
    } else if (id !== GLOBAL && !this.loadedHistory.has(id)) {
      this.send({ type: 'history', to: id });
    }
    this.render();
  }

  private pushOptimistic(partial: Omit<Msg, 'mine' | 'author' | 'delivery'> & { delivery?: Delivery }): void {
    const msg: Msg = {
      ...partial,
      from: this.me?.id,
      mine: true,
      author: this.me?.username,
      delivery: partial.delivery || 'sending',
    };
    const arr = this.messages.get(this.activeId) ?? [];
    arr.push(msg);
    this.messages.set(this.activeId, arr);
    this.lastTs.set(this.activeId, msg.ts);
    this.appendBubble(msg, true, true);
    this.patchConvPreview(this.activeId);
  }

  /** Scroll the thread to the latest message; re-run after media images load. */
  private scrollMessagesToEnd(node?: HTMLElement | null): void {
    const box = this.el('#chat-messages');
    const go = () => {
      box.style.scrollBehavior = 'auto';
      box.scrollTop = box.scrollHeight;
      box.style.scrollBehavior = '';
    };
    go();
    requestAnimationFrame(() => {
      go();
      requestAnimationFrame(go);
    });
    node?.querySelectorAll('img').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', go, { once: true });
      img.addEventListener('error', go, { once: true });
    });
  }

  private submit(): void {
    if (this.voiceRecording) {
      showToast('Stop recording first, then press Send');
      return;
    }
    if (this.pendingVoice) {
      void this.sendPendingVoice();
      return;
    }
    const input = this.el<HTMLTextAreaElement>('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    const clientId = newClientId();
    const ts = Date.now();
    const replyTo = this.replyTo ? { ...this.replyTo } : undefined;
    this.pushOptimistic({ id: clientId, clientId, text, ts, replyTo });
    this.send({
      type: 'message',
      to: this.activeId,
      text,
      clientId,
      replyTo,
    });
    input.value = '';
    this.clearReply();
    this.autoGrow();
    this.el('#chat-emoji-panel').hidden = true;
  }

  private async uploadMedia(file: Blob | File, field: 'image' | 'audio'): Promise<string> {
    const token = getAuthToken();
    if (!token) {
      openAuthModal('signup');
      throw new Error('Sign in required');
    }
    const body = new FormData();
    body.append(field, file, field === 'audio' ? 'voice.webm' : 'image.jpg');
    const res = await fetch('/api/auth/chat-media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  private async sendImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Image must be 8MB or smaller');
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    try {
      const url = await this.uploadMedia(file, 'image');
      const caption = this.el<HTMLTextAreaElement>('#chat-input').value.trim();
      const clientId = newClientId();
      const ts = Date.now();
      this.pushOptimistic({ id: clientId, clientId, text: caption, imageUrl: url, ts });
      this.send({ type: 'message', to: this.activeId, text: caption, imageUrl: url, clientId });
      this.el<HTMLTextAreaElement>('#chat-input').value = '';
      this.autoGrow();
      showToast('Image sent');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send image');
    }
  }

  private async toggleVoiceMessage(): Promise<void> {
    if (this.voiceRecording) {
      await this.finishVoiceRecord();
      return;
    }
    if (this.pendingVoice) {
      showToast('Voice ready — press Send, or Cancel in the chat');
      return;
    }
    await this.startVoiceRecord();
  }

  private async startVoiceRecord(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Voice recording is not supported in this browser');
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      this.recordChunks = [];
      this.pendingVoice = null;
      this.mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) this.recordChunks.push(e.data);
      };
      this.mediaRecorder.start(200);
      this.recordStarted = Date.now();
      this.voiceRecording = true;
      this.el('#chat-voice-msg').classList.add('is-recording');
      this.el('#chat-voice-msg').title = 'Stop recording';
      this.renderMessages();
      window.clearInterval(this.recordTimer);
      this.recordTimer = window.setInterval(() => {
        if (Date.now() - this.recordStarted > 120_000) void this.finishVoiceRecord();
        else this.updateVoiceProgressLabel();
      }, 250);
    } catch {
      showToast('Microphone permission denied');
    }
  }

  private async finishVoiceRecord(): Promise<void> {
    const rec = this.mediaRecorder;
    window.clearInterval(this.recordTimer);
    this.voiceRecording = false;
    this.el('#chat-voice-msg').classList.remove('is-recording');
    this.el('#chat-voice-msg').title = 'Record voice message';
    if (!rec || rec.state === 'inactive') {
      this.mediaRecorder = null;
      this.renderMessages();
      return;
    }
    const durationMs = Date.now() - this.recordStarted;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    });
    this.mediaRecorder = null;
    if (durationMs < 400 || this.recordChunks.length === 0) {
      this.recordChunks = [];
      this.pendingVoice = null;
      showToast('Recording too short');
      this.renderMessages();
      return;
    }
    const blob = new Blob(this.recordChunks, { type: rec.mimeType || 'audio/webm' });
    this.recordChunks = [];
    if (blob.size > 8 * 1024 * 1024) {
      this.pendingVoice = null;
      showToast('Voice message too large');
      this.renderMessages();
      return;
    }
    this.pendingVoice = { blob, durationMs, mime: blob.type || 'audio/webm' };
    this.renderMessages();
    showToast('Voice ready — press Send');
  }

  private cancelPendingVoice(): void {
    if (this.voiceRecording) {
      void this.abortVoiceRecord();
      return;
    }
    this.pendingVoice = null;
    this.renderMessages();
  }

  private async abortVoiceRecord(): Promise<void> {
    const rec = this.mediaRecorder;
    window.clearInterval(this.recordTimer);
    this.voiceRecording = false;
    this.pendingVoice = null;
    this.recordChunks = [];
    this.el('#chat-voice-msg').classList.remove('is-recording');
    this.el('#chat-voice-msg').title = 'Record voice message';
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      });
    }
    this.mediaRecorder = null;
    this.renderMessages();
  }

  private async sendPendingVoice(): Promise<void> {
    const pending = this.pendingVoice;
    if (!pending) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    this.pendingVoice = null;
    this.renderMessages();
    try {
      const url = await this.uploadMedia(pending.blob, 'audio');
      const clientId = newClientId();
      const ts = Date.now();
      this.pushOptimistic({
        id: clientId,
        clientId,
        text: '',
        audioUrl: url,
        durationMs: pending.durationMs,
        ts,
      });
      this.send({
        type: 'message',
        to: this.activeId,
        text: '',
        audioUrl: url,
        durationMs: pending.durationMs,
        clientId,
      });
      showToast('Voice message sent');
    } catch (err) {
      this.pendingVoice = pending;
      this.renderMessages();
      showToast(err instanceof Error ? err.message : 'Could not send voice message');
    }
  }

  private updateVoiceProgressLabel(): void {
    const label = this.el('#chat-messages')?.querySelector('#chat-voice-progress-label');
    if (!label) return;
    const ms = Date.now() - this.recordStarted;
    label.textContent = `Voice in progress… ${fmtDuration(ms)}`;
  }

  private voiceProgressHtml(): string {
    if (this.voiceRecording) {
      const ms = Date.now() - this.recordStarted;
      return `<div class="chat-voice-progress" id="chat-voice-progress">
        <span class="chat-rec-dot" aria-hidden="true"></span>
        <span id="chat-voice-progress-label">Voice in progress… ${fmtDuration(ms)}</span>
        <button type="button" id="chat-voice-cancel">Cancel</button>
      </div>`;
    }
    if (this.pendingVoice) {
      return `<div class="chat-voice-progress is-ready" id="chat-voice-progress">
        <span>Voice ready · ${fmtDuration(this.pendingVoice.durationMs)} — press Send</span>
        <button type="button" id="chat-voice-cancel">Cancel</button>
      </div>`;
    }
    return '';
  }

  private toggleInfo(force?: boolean): void {
    this.infoOpen = force ?? !this.infoOpen;
    this.root.classList.toggle('info-collapsed', !this.infoOpen);
  }

  private convList(): { id: string; name: string; kind: ChatKind; online: boolean }[] {
    const list: { id: string; name: string; kind: ChatKind; online: boolean }[] = [
      { id: GLOBAL, name: 'LINK Lobby', kind: 'group', online: true },
    ];
    const seen = new Set<string>([GLOBAL]);

    for (const [id, g] of this.groups) {
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({
        id,
        name: g.name,
        kind: 'group',
        online: g.members.some((m) => this.online.has(m)),
      });
    }

    for (const [id, name] of this.online) {
      if (id === this.me?.id || seen.has(id)) continue;
      seen.add(id);
      list.push({ id, name, kind: 'dm', online: true });
    }

    for (const convId of this.messages.keys()) {
      if (seen.has(convId) || convId === GLOBAL || isGroupId(convId)) continue;
      seen.add(convId);
      list.push({
        id: convId,
        name: this.names.get(convId) ?? 'Player',
        kind: 'dm',
        online: this.online.has(convId),
      });
    }

    const q = this.query.trim().toLowerCase();
    if (q) {
      for (const p of this.searchPeople) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        list.push({ id: p.id, name: p.name, kind: 'dm', online: p.online });
        this.names.set(p.id, p.name);
        if (p.avatarUrl) this.avatars.set(p.id, p.avatarUrl);
      }
      for (const g of this.searchGroups) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        list.push({ id: g.id, name: g.name, kind: 'group', online: g.online });
        this.names.set(g.id, g.name);
      }
      for (const u of this.directory.values()) {
        if (u.id === this.me?.id || seen.has(u.id)) continue;
        if (!u.username.toLowerCase().includes(q)) continue;
        seen.add(u.id);
        list.push({ id: u.id, name: u.username, kind: 'dm', online: this.online.has(u.id) });
      }
    }

    return list.filter((c) => {
      if (this.filter === 'online' && !c.online) return false;
      if (this.filter === 'groups' && c.kind !== 'group') return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private render(): void {
    this.renderList();
    this.renderHead();
    this.renderVoiceDock();
    this.renderMessages();
    this.renderInfo();
    this.root.classList.toggle('info-collapsed', !this.infoOpen);
  }

  private renderGuest(): void {
    this.el('#chat-conv-list').innerHTML = `<div class="chat-empty-list">${
      getAuthToken() ? 'Join to see people online' : 'Sign in to chat'
    }</div>`;
    this.el('#chat-thread-head').innerHTML = '';
    this.el('#chat-messages').innerHTML = '';
    this.el('#chat-info-body').innerHTML = '';
  }

  /** Update one conversation row in place (avoids full list re-render flicker). */
  private patchConvPreview(convId: string): void {
    const list = this.el('#chat-conv-list');
    const btn = list.querySelector<HTMLElement>(`.chat-conv[data-id="${CSS.escape(convId)}"]`);
    if (!btn) {
      this.renderList();
      return;
    }
    const preview = btn.querySelector('.chat-conv-preview');
    const time = btn.querySelector('.chat-conv-time');
    const flags = btn.querySelector('.chat-conv-flags');
    if (preview) preview.textContent = this.lastPreview(convId);
    const ts = this.lastTs.get(convId);
    if (time) time.textContent = ts ? fmtTime(ts) : '';
    const unread = this.unread.get(convId) ?? 0;
    if (flags) {
      flags.innerHTML = unread > 0 ? `<span class="chat-unread">${unread > 99 ? '99+' : unread}</span>` : '';
    }
  }

  private lastPreview(convId: string): string {
    const arr = this.messages.get(convId);
    if (!arr || arr.length === 0) {
      if (convId === GLOBAL) return 'Say hi to everyone online';
      if (isGroupId(convId)) return 'Group chat — say hello';
      return 'No messages yet';
    }
    const m = arr[arr.length - 1];
    const who = `${m.mine ? 'You: ' : m.author ? `${m.author}: ` : ''}`;
    if (m.audioUrl && !m.text) return `${who}Voice message`;
    if (m.imageUrl && !m.text) return `${who}Photo`;
    return `${who}${m.text}`;
  }

  private renderList(): void {
    const list = this.el('#chat-conv-list');
    const items = this.convList().sort((a, b) => {
      if (a.id === GLOBAL) return -1;
      if (b.id === GLOBAL) return 1;
      return (this.lastTs.get(b.id) ?? 0) - (this.lastTs.get(a.id) ?? 0);
    });
    if (items.length === 0) {
      list.innerHTML = `<div class="chat-empty-list">No chats found</div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const unread = this.unread.get(c.id) ?? 0;
        const ts = this.lastTs.get(c.id);
        const kindIcon = c.kind === 'group' ? `<span class="chat-kind">${icons.users()}</span>` : '';
        const ava = this.avatars.get(c.id) || '';
        return `
        <button type="button" class="chat-conv${c.id === this.activeId ? ' active' : ''}" data-id="${c.id}" role="listitem">
          <span class="chat-conv-avatar">
            ${avatarHtml(c.name, '', ava)}
            ${c.kind === 'dm' || c.id === GLOBAL || c.kind === 'group' ? statusDot(c.online) : ''}
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
      return { name: 'LINK Lobby', kind: 'group', online: true, status: `${this.online.size} online` };
    }
    if (isGroupId(this.activeId)) {
      const g = this.groups.get(this.activeId);
      const live = g ? g.members.filter((m) => this.online.has(m)).length : 0;
      return {
        name: g?.name ?? this.names.get(this.activeId) ?? 'Group',
        kind: 'group',
        online: live > 0,
        status: `${live} online · ${g?.members.length ?? 0} members`,
      };
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
    const ava = this.avatars.get(this.activeId) || '';
    const inVoice = this.voice.connected;
    const voiceAllowed = c.kind === 'dm';
    const voiceTitle = !voiceAllowed
      ? 'Voice only available in 1:1 chats'
      : inVoice
        ? 'Leave voice'
        : 'Join voice';
    this.el('#chat-thread-head').innerHTML = `
      <div class="chat-thread-user">
        <button type="button" class="chat-back-mobile" id="chat-back-list" aria-label="Back to conversations">←</button>
        <span class="chat-conv-avatar lg">
          ${avatarHtml(c.name, 'lg', ava)}
          ${statusDot(c.online)}
        </span>
        <div>
          <div class="chat-thread-name">${escapeHtml(c.name)}</div>
          <div class="chat-thread-status">${escapeHtml(inVoice && voiceAllowed ? 'In voice channel' : c.status)}</div>
        </div>
      </div>
      <div class="chat-thread-actions">
        <button type="button" class="chat-voice-btn${inVoice && voiceAllowed ? ' is-live' : ''}${voiceAllowed ? '' : ' is-disabled'}" id="chat-voice-call" title="${voiceTitle}" ${voiceAllowed ? '' : 'disabled aria-disabled="true"'}>
          ${icons.voice()}
          <span>${inVoice && voiceAllowed ? 'Leave' : 'Voice'}</span>
        </button>
        <button type="button" class="chat-tool" id="chat-info-toggle" title="Details">${icons.info()}</button>
      </div>
    `;
    this.el('#chat-back-list')?.addEventListener('click', () => {
      this.toggleInfo(false);
      this.root.classList.remove('thread-open');
      this.root.classList.add('list-open');
    });
  }

  /** Keep the composer visible when the mobile keyboard opens. */
  private bindViewport(): void {
    const sync = () => {
      const dash = this.root.closest('.dash') as HTMLElement | null;
      if (!dash?.classList.contains('is-chat')) {
        this.root.style.height = '';
        return;
      }
      const vv = window.visualViewport;
      const header = document.querySelector('.dash-header') as HTMLElement | null;
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      if (!vv) {
        this.root.style.height = '';
        return;
      }
      // Only pin height while the soft keyboard (or browser chrome) shrinks the visual viewport.
      const shrunk = vv.height < window.innerHeight - 60;
      if (!shrunk) {
        this.root.style.height = '';
        return;
      }
      const h = Math.max(220, Math.round(vv.height - Math.max(0, headerBottom - vv.offsetTop)));
      this.root.style.height = `${h}px`;
    };
    this.syncViewport = sync;
    sync();
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
  }

  /** Called when entering/leaving chat view. */
  layout(): void {
    this.syncViewport?.();
  }

  private renderMessages(): void {
    if (!this.me) {
      this.renderGuest();
      return;
    }
    const box = this.el('#chat-messages');
    const arr = this.messages.get(this.activeId) ?? [];
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const parts: string[] = ['<div class="chat-msg-spacer"></div>'];
    if (arr.length === 0) {
      parts.push(
        `<div class="chat-empty-main"><h3>${escapeHtml(this.activeMeta().name)}</h3><p>${
          this.activeId === GLOBAL
            ? 'This is the global lobby. Messages are shared with everyone online.'
            : isGroupId(this.activeId)
              ? 'Group chat is live. Share plans, clips, and callouts here.'
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
        parts.push(this.bubbleHtml(m, false));
      }
    }
    const progress = this.voiceProgressHtml();
    if (progress) parts.push(progress);
    box.innerHTML = parts.join('');
    if (nearBottom || arr.length < 40) {
      box.style.scrollBehavior = 'auto';
      box.scrollTop = box.scrollHeight;
      box.style.scrollBehavior = '';
    }
  }

  private bubbleHtml(m: Msg, animate: boolean): string {
    const showAuthor = (this.activeId === GLOBAL || isGroupId(this.activeId)) && !m.mine;
    const pending = m.mine && m.delivery && m.delivery !== 'delivered';
    const reply = m.replyTo
      ? `<button type="button" class="chat-reply-quote" data-jump="${escapeHtml(m.replyTo.id)}"><strong>${escapeHtml(m.replyTo.fromName)}</strong><span>${escapeHtml(m.replyTo.text || 'Message')}</span></button>`
      : '';
    return `
      <article class="chat-bubble ${m.mine ? 'mine' : 'theirs'}${pending ? ' is-pending' : ''}${animate ? ' is-new' : ''}" data-id="${escapeHtml(m.id)}" data-client="${escapeHtml(m.clientId || '')}">
        ${showAuthor ? `<div class="chat-author">${escapeHtml(m.author ?? 'Player')}</div>` : ''}
        ${reply}
        <div class="chat-bubble-body">
          ${m.imageUrl ? `<a class="chat-image-link" href="${escapeHtml(m.imageUrl)}" target="_blank" rel="noopener"><img class="chat-image" src="${escapeHtml(m.imageUrl)}" alt="Shared image" loading="lazy" /></a>` : ''}
          ${m.stickerUrl ? `<img class="chat-sticker" src="${escapeHtml(m.stickerUrl)}" alt="Sticker" loading="lazy" />` : ''}
          ${m.gifUrl ? `<img class="chat-gif" src="${escapeHtml(m.gifUrl)}" alt="GIF" loading="lazy" />` : ''}
          ${
            m.audioUrl
              ? `<div class="chat-audio"><audio controls preload="metadata" src="${escapeHtml(m.audioUrl)}"></audio>${
                  m.durationMs ? `<span class="chat-audio-dur">${fmtDuration(m.durationMs)}</span>` : ''
                }</div>`
              : ''
          }
          ${m.text ? `<p>${escapeHtml(m.text)}</p>` : ''}
        </div>
        <div class="chat-meta">
          <span>${fmtTime(m.ts)}</span>
          ${m.mine ? deliveryTicks(m.delivery) : ''}
          <button type="button" class="chat-reply-btn" data-reply-id="${escapeHtml(m.id)}" title="Reply">Reply</button>
        </div>
      </article>`;
  }

  private appendBubble(m: Msg, animate: boolean, forceScroll = false): void {
    const box = this.el('#chat-messages');
    box.querySelector('.chat-empty-main')?.remove();
    if (!box.querySelector('.chat-day') && !m.system) {
      const day = document.createElement('div');
      day.className = 'chat-day';
      day.innerHTML = '<span>Today</span>';
      const spacer = box.querySelector('.chat-msg-spacer');
      if (spacer?.nextSibling) box.insertBefore(day, spacer.nextSibling);
      else box.appendChild(day);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = this.bubbleHtml(m, animate);
    const node = wrap.firstElementChild as HTMLElement;
    const progress = box.querySelector('.chat-voice-progress');
    if (progress) box.insertBefore(node, progress);
    else box.appendChild(node);
    if (animate) {
      node.addEventListener(
        'animationend',
        () => node.classList.remove('is-new'),
        { once: true },
      );
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (forceScroll || m.mine || nearBottom) {
      this.scrollMessagesToEnd(node);
    }
  }

  private patchBubble(m: Msg): void {
    const box = this.el('#chat-messages');
    let el =
      (box.querySelector(`[data-id="${CSS.escape(m.id)}"]`) as HTMLElement | null) ||
      (m.clientId ? (box.querySelector(`[data-client="${CSS.escape(m.clientId)}"]`) as HTMLElement | null) : null);
    if (!el) {
      this.appendBubble(m, false);
      return;
    }
    el.dataset.id = m.id;
    if (m.clientId) el.dataset.client = m.clientId;
    el.classList.toggle('is-pending', !!(m.mine && m.delivery && m.delivery !== 'delivered'));
    const meta = el.querySelector('.chat-meta');
    if (meta && m.mine) {
      const time = meta.querySelector('span');
      meta.innerHTML = `<span>${fmtTime(m.ts)}</span>${deliveryTicks(m.delivery)}<button type="button" class="chat-reply-btn" data-reply-id="${escapeHtml(m.id)}" title="Reply">Reply</button>`;
      void time;
    }
  }

  private patchHeadStatus(): void {
    const status = this.root.querySelector('.chat-thread-status');
    if (!status) return;
    const c = this.activeMeta();
    const inVoice = this.voice.connected && c.kind === 'dm';
    status.textContent = inVoice ? 'In voice channel' : c.status;
  }

  private patchInfoPresence(): void {
    if (this.infoUserId) return;
    this.root.querySelectorAll<HTMLElement>('[data-user-id]').forEach((row) => {
      const id = row.dataset.userId!;
      const live = this.online.has(id);
      row.classList.toggle('is-online', live);
      row.classList.toggle('is-offline', !live);
      const tag = row.querySelector('.chat-member-status') || row.querySelector(':scope > span:last-child');
      if (tag) tag.textContent = id === this.me?.id ? 'You' : live ? 'Online' : 'Offline';
    });
  }

  private setReply(target: { id: string; text: string; fromName: string }): void {
    this.replyTo = target;
    const bar = this.el('#chat-reply-bar');
    bar.hidden = false;
    this.el('#chat-reply-name').textContent = target.fromName;
    this.el('#chat-reply-snip').textContent = target.text || 'Message';
    this.el<HTMLTextAreaElement>('#chat-input').focus();
  }

  private clearReply(): void {
    this.replyTo = null;
    const bar = this.root.querySelector('#chat-reply-bar') as HTMLElement | null;
    if (bar) bar.hidden = true;
  }

  private async ensureMediaPack(): Promise<void> {
    if (this.mediaStickers.length || this.mediaGifs.length) {
      this.renderMediaPanes();
      return;
    }
    try {
      const [sRes, gRes] = await Promise.all([
        fetch('/api/media-pack?kind=sticker'),
        fetch('/api/media-pack?kind=gif'),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const gData = await gRes.json().catch(() => ({}));
      const uploadedStickers: MediaItem[] = Array.isArray(sData.items) ? sData.items : [];
      const uploadedGifs: MediaItem[] = Array.isArray(gData.items) ? gData.items : [];
      this.mediaStickers = [...BUILTIN_STICKERS, ...uploadedStickers];
      this.mediaGifs = [...BUILTIN_GIFS, ...uploadedGifs];
    } catch {
      this.mediaStickers = [...BUILTIN_STICKERS];
      this.mediaGifs = [...BUILTIN_GIFS];
    }
    this.renderMediaPanes();
  }

  private renderMediaPanes(): void {
    const stickerPane = this.el('#chat-media-sticker');
    const gifPane = this.el('#chat-media-gif');
    const stickers = this.mediaStickers.length ? this.mediaStickers : BUILTIN_STICKERS;
    const gifs = this.mediaGifs.length ? this.mediaGifs : BUILTIN_GIFS;
    stickerPane.innerHTML = stickers
      .map(
        (m) =>
          `<button type="button" class="chat-media-card" data-media-kind="sticker" data-media-url="${escapeHtml(m.assetUrl)}" title="${escapeHtml(m.name)}"><img src="${escapeHtml(m.previewUrl)}" alt="" loading="lazy" /></button>`,
      )
      .join('');
    gifPane.innerHTML = gifs
      .map(
        (m) =>
          `<button type="button" class="chat-media-card" data-media-kind="gif" data-media-url="${escapeHtml(m.assetUrl)}" title="${escapeHtml(m.name)}"><img src="${escapeHtml(m.previewUrl)}" alt="" loading="lazy" /></button>`,
      )
      .join('');
  }

  private async sendMediaChip(kind: 'sticker' | 'gif', url: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('Reconnecting… try again in a moment.');
      return;
    }
    const clientId = newClientId();
    const ts = Date.now();
    const replyTo = this.replyTo ? { ...this.replyTo } : undefined;
    const partial: Omit<Msg, 'mine' | 'author' | 'delivery'> & { delivery?: Delivery } = {
      id: clientId,
      clientId,
      text: '',
      ts,
      replyTo,
      stickerUrl: kind === 'sticker' ? url : undefined,
      gifUrl: kind === 'gif' ? url : undefined,
    };
    this.pushOptimistic(partial);
    this.send({
      type: 'message',
      to: this.activeId,
      text: '',
      clientId,
      replyTo,
      stickerUrl: kind === 'sticker' ? url : undefined,
      gifUrl: kind === 'gif' ? url : undefined,
    });
    this.clearReply();
    this.el('#chat-emoji-panel').hidden = true;
  }

  private async loadCosmeticsFor(userId: string): Promise<{ nameplateUrl?: string }> {
    if (this.cosmeticsCache.has(userId)) return this.cosmeticsCache.get(userId)!;
    try {
      const res = await fetch(`/api/cosmetics/equipped/${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      const resolved = {
        nameplateUrl: data.nameplate?.previewUrl as string | undefined,
      };
      this.cosmeticsCache.set(userId, resolved);
      return resolved;
    } catch {
      const empty = {};
      this.cosmeticsCache.set(userId, empty);
      return empty;
    }
  }

  private memberRow(id: string, live: boolean): string {
    const name = this.names.get(id) ?? 'Player';
    const cos = this.cosmeticsCache.get(id) || {};
    const ava = avatarHtml(name, '', this.avatars.get(id) || '');
    return memberNameplateRow({
      userId: id,
      name,
      statusLabel: id === this.me?.id ? 'You' : live ? 'Online' : 'Offline',
      live,
      avatarShellHtml: `${ava}${statusDot(live)}`,
      nameplateUrl: cos.nameplateUrl,
    });
  }

  private renderInfo(): void {
    if (!this.me) return;
    if (this.infoUserId) {
      void this.renderUserDetail(this.infoUserId);
      return;
    }
    const c = this.activeMeta();
    const ava = this.avatars.get(this.activeId) || '';
    const memberIds =
      this.activeId === GLOBAL
        ? [...this.online.keys(), ...[...this.directory.values()].filter((u) => !this.online.has(u.id)).map((u) => u.id)]
        : isGroupId(this.activeId)
          ? this.groups.get(this.activeId)?.members ?? []
          : [];
    for (const id of memberIds) void this.loadCosmeticsFor(id).then(() => {
      /* refreshed below after batch */
    });
    // Prefetch then paint (short delay coalesce)
    void Promise.all(memberIds.slice(0, 40).map((id) => this.loadCosmeticsFor(id))).then(() => {
      if (!this.infoUserId) this.paintInfoMembers(c, ava);
    });
    this.paintInfoMembers(c, ava);
  }

  private paintInfoMembers(c: { name: string; status: string; online: boolean }, ava: string): void {
    if (this.activeId === GLOBAL) {
      const onlineIds = [...this.online.keys()];
      const offline = [...this.directory.values()].filter((u) => !this.online.has(u.id));
      for (const u of offline) this.names.set(u.id, u.username);
      this.el('#chat-info-body').innerHTML = `
        <div class="chat-info-profile">
          <span class="chat-conv-avatar xl-wrap">${avatarHtml(c.name, 'xl')}${statusDot(true)}</span>
          <h4>${escapeHtml(c.name)}</h4>
          <p>${escapeHtml(c.status)}</p>
        </div>
        <div class="chat-members">
          <div class="chat-members-block">
            <h5>${icons.users()} Online now · ${onlineIds.length}</h5>
            <ul>${onlineIds.map((id) => this.memberRow(id, true)).join('') || '<li>No one is online</li>'}</ul>
          </div>
          <div class="chat-members-block">
            <h5>Offline now · ${offline.length}</h5>
            <ul>${offline.map((u) => this.memberRow(u.id, false)).join('') || '<li>No offline players</li>'}</ul>
          </div>
        </div>`;
    } else if (isGroupId(this.activeId)) {
      const g = this.groups.get(this.activeId);
      const members = g?.members ?? [];
      const creatorId = g?.createdBy || '';
      const creatorName = creatorId ? this.names.get(creatorId) || 'Player' : '';
      const onlineIds = members.filter((id) => this.online.has(id));
      const offlineIds = members.filter((id) => !this.online.has(id));
      this.el('#chat-info-body').innerHTML = `
        <div class="chat-info-profile">
          <span class="chat-conv-avatar xl-wrap">${avatarHtml(c.name, 'xl')}${statusDot(c.online)}</span>
          <h4>${escapeHtml(c.name)}</h4>
          <p>${escapeHtml(c.status)}</p>
        </div>
        ${
          creatorId
            ? `<div class="chat-role-admin"><em>ADMIN</em> <strong>${escapeHtml(creatorName)}</strong>${creatorId === this.me!.id ? ' · You' : ''}</div>`
            : ''
        }
        <div class="chat-members">
          <div class="chat-members-block">
            <h5>${icons.users()} Online now · ${onlineIds.length}</h5>
            <ul>${onlineIds.map((id) => this.memberRow(id, true)).join('') || '<li>No one is online</li>'}</ul>
          </div>
          <div class="chat-members-block">
            <h5>Offline now · ${offlineIds.length}</h5>
            <ul>${offlineIds.map((id) => this.memberRow(id, false)).join('') || '<li>No offline members</li>'}</ul>
          </div>
        </div>`;
    } else {
      this.el('#chat-info-body').innerHTML = `
        <div class="chat-info-profile">
          <span class="chat-conv-avatar xl-wrap">${avatarHtml(c.name, 'xl', ava)}${statusDot(c.online)}</span>
          <h4>${escapeHtml(c.name)}</h4>
          <p>${escapeHtml(c.status)}</p>
        </div>
        <div class="chat-about">
          <h5>Direct message</h5>
          <p>Messages are delivered in real time while ${escapeHtml(c.name)} is online. Voice calls are available here.</p>
        </div>`;
      void this.renderUserDetail(this.activeId, true);
    }
  }

  private async renderUserDetail(userId: string, embedInDm = false): Promise<void> {
    const name = this.names.get(userId) || this.directory.get(userId)?.username || 'Player';
    const live = this.online.has(userId);
    const ava = this.avatars.get(userId) || '';
    const cos = await this.loadCosmeticsFor(userId);
    const shell = avatarHtml(name, 'xl', ava);
    const body = `
      ${embedInDm ? '' : `<button type="button" class="chat-info-back" id="chat-info-back-members">← Members</button>`}
        <div class="chat-user-detail">
        <div class="chat-user-hero${cos.nameplateUrl ? ' has-nameplate' : ''}"${
          cos.nameplateUrl ? ` style="--cos-plate:url('${cos.nameplateUrl.replace(/'/g, '%27')}')"` : ''
        }>
          ${cos.nameplateUrl ? `<span class="chat-user-plate" aria-hidden="true"></span>` : ''}
          <span class="chat-conv-avatar xl-wrap cos-detail">${shell}${statusDot(live)}</span>
        </div>
        <h4 class="chat-user-detail-name">${escapeHtml(name)}</h4>
        <p>${live ? 'Online' : 'Offline'}${userId === this.me?.id ? ' · You' : ''}</p>
        ${
          userId !== this.me?.id
            ? `<button type="button" class="chat-join-btn" id="chat-info-dm" style="margin-top:14px;min-width:0;width:100%">Message</button>`
            : ''
        }
      </div>`;
    if (embedInDm) {
      const profile = this.root.querySelector('.chat-info-profile .chat-conv-avatar');
      if (profile) profile.innerHTML = `${shell}${statusDot(live)}`;
      return;
    }
    this.el('#chat-info-body').innerHTML = body;
  }
}

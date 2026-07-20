/** LINK Chat Room — Telegram-inspired messaging UI with mock real-time behavior */

import { showToast } from './ui';

export type ChatKind = 'dm' | 'group' | 'channel';
export type ChatFilter = 'all' | 'unread' | 'pinned' | 'groups' | 'channels' | 'friends' | 'favorites' | 'archive';

export interface ChatMessage {
  id: string;
  from: 'me' | 'them' | 'system';
  author?: string;
  text: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  replyTo?: string;
  reactions?: { emoji: string; count: number }[];
  type?: 'text' | 'image' | 'file' | 'voice' | 'code' | 'poll';
  fileName?: string;
  fileSize?: string;
}

export interface Conversation {
  id: string;
  name: string;
  kind: ChatKind;
  avatar: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  typing?: boolean;
  pinned?: boolean;
  muted?: boolean;
  favorite?: boolean;
  archived?: boolean;
  statusText?: string;
  members?: number;
  messages: ChatMessage[];
}

const AVATARS = [
  '/position/user1.png',
  '/position/user2.png',
  '/position/image1.png',
  '/position/image2.png',
  '/position/image3.png',
  '/position/image4.png',
];

function seedConversations(): Conversation[] {
  return [
    {
      id: 'c1',
      name: 'NeonX',
      kind: 'dm',
      avatar: AVATARS[1],
      preview: 'Ready for ranked tonight?',
      time: '12:41',
      unread: 2,
      online: true,
      favorite: true,
      statusText: 'Online',
      messages: [
        { id: 'm1', from: 'them', text: 'Yo — queue up for Neon Storm?', time: '12:30', status: 'read' },
        { id: 'm2', from: 'me', text: 'Give me 5. Finishing daily missions.', time: '12:33', status: 'read' },
        { id: 'm3', from: 'them', text: 'Ready for ranked tonight?', time: '12:41', status: 'delivered' },
      ],
    },
    {
      id: 'c2',
      name: 'LINK Squad',
      kind: 'group',
      avatar: AVATARS[2],
      preview: 'ShadowLink: Zone hold mid — go!',
      time: '11:58',
      unread: 14,
      pinned: true,
      members: 8,
      statusText: '8 members · 3 online',
      typing: true,
      messages: [
        { id: 'g1', from: 'system', text: 'ShadowLink pinned a message', time: '11:40' },
        { id: 'g2', from: 'them', author: 'CyberNull', text: 'Who is free for custom lobby?', time: '11:45', status: 'read' },
        { id: 'g3', from: 'them', author: 'ShadowLink', text: 'Zone hold mid — go!', time: '11:58', status: 'read', reactions: [{ emoji: '🔥', count: 3 }] },
        { id: 'g4', from: 'me', text: 'On my way. Loadout locked.', time: '11:59', status: 'read' },
      ],
    },
    {
      id: 'c3',
      name: 'LINK Announcements',
      kind: 'channel',
      avatar: AVATARS[3],
      preview: 'Patch 0.1.0 is live — balance notes inside.',
      time: 'Yesterday',
      unread: 0,
      muted: true,
      members: 12840,
      statusText: '12.8K subscribers',
      messages: [
        {
          id: 'ch1',
          from: 'them',
          author: 'LINK Team',
          text: 'Patch 0.1.0 is live — balance notes, QoL, and Neon Storm rewards.',
          time: 'Yesterday',
          status: 'read',
        },
        {
          id: 'ch2',
          from: 'them',
          author: 'LINK Team',
          text: '```balance\nDash cooldown: 4.2s → 3.8s\nZone score rate +8%\n```',
          time: 'Yesterday',
          type: 'code',
          status: 'read',
        },
      ],
    },
    {
      id: 'c4',
      name: 'PulseFire',
      kind: 'dm',
      avatar: AVATARS[4],
      preview: 'Sent a voice message',
      time: '10:12',
      unread: 0,
      online: false,
      statusText: 'Last seen 42m ago',
      messages: [
        { id: 'p1', from: 'them', text: 'Nice clutch on that ranked game.', time: '10:05', status: 'read' },
        { id: 'p2', from: 'them', text: '🎤 Voice message · 0:18', time: '10:12', type: 'voice', status: 'read' },
        { id: 'p3', from: 'me', text: 'Thanks — rematch later?', time: '10:15', status: 'read' },
      ],
    },
    {
      id: 'c5',
      name: 'Clan War Room',
      kind: 'group',
      avatar: AVATARS[5],
      preview: 'You: Shared Neon Storm.png',
      time: 'Mon',
      unread: 0,
      favorite: true,
      members: 24,
      statusText: '24 members · 6 online',
      messages: [
        { id: 'w1', from: 'them', author: 'LinkMaster', text: 'Scrim schedule posted in #events.', time: 'Mon', status: 'read' },
        {
          id: 'w2',
          from: 'me',
          text: '📎 Neon Storm.png',
          time: 'Mon',
          type: 'file',
          fileName: 'Neon Storm.png',
          fileSize: '2.4 MB',
          status: 'read',
        },
      ],
    },
    {
      id: 'c6',
      name: 'CyberNull',
      kind: 'dm',
      avatar: AVATARS[0],
      preview: 'Pinned: practice arena codes',
      time: 'Sun',
      unread: 0,
      pinned: true,
      online: true,
      statusText: 'Online',
      messages: [
        { id: 'n1', from: 'them', text: 'Practice arena codes for this week.', time: 'Sun', status: 'read' },
        { id: 'n2', from: 'me', text: 'Got them — thanks.', time: 'Sun', status: 'read' },
      ],
    },
    {
      id: 'c7',
      name: 'Archive · Old Duo',
      kind: 'dm',
      avatar: AVATARS[2],
      preview: 'gg season 0',
      time: 'Apr',
      unread: 0,
      archived: true,
      statusText: 'Archived',
      messages: [{ id: 'a1', from: 'them', text: 'gg season 0', time: 'Apr', status: 'read' }],
    },
  ];
}

function ico(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const icons = {
  search: () => ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: () => ico('<path d="M12 5v14M5 12h14"/>'),
  pin: () => ico('<path d="M12 17v5M9 3h6l-1 7h3l-5 6-5-6h3L9 3z"/>'),
  mute: () => ico('<path d="M11 5 6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6"/>'),
  more: () => ico('<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),
  attach: () => ico('<path d="m21.44 11.05-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 1 1-2.12-2.12l7.78-7.78"/>'),
  emoji: () => ico('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'),
  mic: () => ico('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  send: () => ico('<path d="m22 2-7 20-4-9-9-4 20-7z"/>'),
  info: () => ico('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>'),
  phone: () => ico('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.1a16 16 0 0 0 6 6l.8-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9z"/>'),
  check: () => ico('<path d="m5 12 4 4L19 6"/>'),
  checks: () => ico('<path d="m2 12 4 4L15 7M8 12l4 4 9-10"/>'),
  close: () => ico('<path d="M6 6l12 12M18 6 6 18"/>'),
  image: () => ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>'),
  users: () => ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
  hash: () => ico('<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>'),
  star: () => ico('<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3z"/>'),
  archive: () => ico('<path d="M3 7h18v13H3zM3 7l2-4h14l2 4M10 12h4"/>'),
  reply: () => ico('<path d="M9 14 4 9l5-5M4 9h11a4 4 0 0 1 0 8h-1"/>'),
};

export function chatRoomHTML(): string {
  return `
  <section class="chat-room" id="chat-room" aria-label="LINK Chat Room">
    <!-- LEFT: conversation list -->
    <aside class="chat-list-panel">
      <div class="chat-list-head">
        <div class="chat-search">
          ${icons.search()}
          <input type="search" id="chat-search" placeholder="Search conversations…" autocomplete="off" />
        </div>
        <button type="button" class="chat-new-btn" id="chat-new" title="New conversation" aria-label="New conversation">${icons.plus()}</button>
      </div>

      <div class="chat-filters" id="chat-filters" role="tablist">
        <button type="button" class="chat-filter active" data-filter="all">All</button>
        <button type="button" class="chat-filter" data-filter="unread">Unread</button>
        <button type="button" class="chat-filter" data-filter="pinned">Pinned</button>
        <button type="button" class="chat-filter" data-filter="friends">Friends</button>
        <button type="button" class="chat-filter" data-filter="groups">Groups</button>
        <button type="button" class="chat-filter" data-filter="channels">Channels</button>
        <button type="button" class="chat-filter" data-filter="favorites">Favorites</button>
        <button type="button" class="chat-filter" data-filter="archive">Archive</button>
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
        <button type="button" class="chat-tool" id="chat-attach" title="Attachments">${icons.attach()}</button>
        <button type="button" class="chat-tool" id="chat-emoji" title="Emoji">${icons.emoji()}</button>
        <div class="chat-input-wrap">
          <textarea id="chat-input" rows="1" placeholder="Message…" aria-label="Message input"></textarea>
        </div>
        <button type="button" class="chat-tool" id="chat-voice" title="Voice message">${icons.mic()}</button>
        <button type="button" class="chat-send" id="chat-send" title="Send" aria-label="Send">${icons.send()}</button>
      </footer>
      <div class="chat-emoji-panel" id="chat-emoji-panel" hidden>
        ${['😀','🔥','⚡','💜','🎮','🏆','👍','😂','😎','🚀','✨','💜','🎯','💥','🟣','👾'].map((e) => `<button type="button" class="chat-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
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

    <div class="chat-ctx" id="chat-ctx" hidden role="menu"></div>
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

function formatMessageBody(m: ChatMessage): string {
  if (m.type === 'code' || m.text.includes('```')) {
    const code = m.text.replace(/```\w*\n?/g, '').replace(/```/g, '');
    return `<pre class="chat-code">${escapeHtml(code.trim())}</pre>`;
  }
  if (m.type === 'file') {
    return `
      <div class="chat-file">
        <span class="chat-file-ico">${icons.attach()}</span>
        <span class="chat-file-meta">
          <strong>${escapeHtml(m.fileName ?? 'File')}</strong>
          <small>${escapeHtml(m.fileSize ?? '')}</small>
        </span>
        <button type="button" class="chat-file-dl">Download</button>
      </div>`;
  }
  if (m.type === 'voice') {
    return `
      <div class="chat-voice">
        <button type="button" class="chat-voice-play">▶</button>
        <span class="chat-voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        <span class="chat-voice-dur">0:18</span>
      </div>`;
  }
  return `<p>${escapeHtml(m.text)}</p>`;
}

function statusTicks(status?: ChatMessage['status']): string {
  if (!status || status === 'sending') return `<span class="chat-ticks pending">·</span>`;
  if (status === 'sent') return `<span class="chat-ticks">${icons.check()}</span>`;
  if (status === 'delivered') return `<span class="chat-ticks">${icons.checks()}</span>`;
  return `<span class="chat-ticks read">${icons.checks()}</span>`;
}

export class ChatApp {
  private root: HTMLElement;
  private convs: Conversation[];
  private activeId: string;
  private filter: ChatFilter = 'all';
  private query = '';
  private infoOpen = true;

  constructor(root: HTMLElement) {
    this.root = root;
    this.convs = seedConversations();
    this.activeId = this.convs.find((c) => !c.archived)?.id ?? this.convs[0].id;
    this.bind();
    this.render();
  }

  private el<T extends HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private active(): Conversation {
    return this.convs.find((c) => c.id === this.activeId) ?? this.convs[0];
  }

  private filtered(): Conversation[] {
    const q = this.query.trim().toLowerCase();
    return this.convs.filter((c) => {
      if (this.filter === 'archive') return !!c.archived;
      if (c.archived) return false;
      if (this.filter === 'unread' && c.unread <= 0) return false;
      if (this.filter === 'pinned' && !c.pinned) return false;
      if (this.filter === 'favorites' && !c.favorite) return false;
      if (this.filter === 'friends' && c.kind !== 'dm') return false;
      if (this.filter === 'groups' && c.kind !== 'group') return false;
      if (this.filter === 'channels' && c.kind !== 'channel') return false;
      if (q && !`${c.name} ${c.preview}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private bind(): void {
    this.el('#chat-search').addEventListener('input', (e) => {
      this.query = (e.target as HTMLInputElement).value;
      this.renderList();
    });

    this.el('#chat-filters').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-filter');
      if (!btn) return;
      this.filter = btn.dataset.filter as ChatFilter;
      this.el('#chat-filters').querySelectorAll('.chat-filter').forEach((b) => b.classList.toggle('active', b === btn));
      this.renderList();
    });

    this.el('#chat-conv-list').addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.chat-conv');
      if (!row?.dataset.id) return;
      this.select(row.dataset.id);
    });

    this.el('#chat-conv-list').addEventListener('contextmenu', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.chat-conv');
      if (!row?.dataset.id) return;
      e.preventDefault();
      this.openContext(e.clientX, e.clientY, row.dataset.id);
    });

    this.el('#chat-send').addEventListener('click', () => this.send());
    this.el<HTMLTextAreaElement>('#chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    this.el<HTMLTextAreaElement>('#chat-input').addEventListener('input', () => this.autoGrow());

    this.el('#chat-emoji').addEventListener('click', () => {
      const panel = this.el('#chat-emoji-panel');
      panel.hidden = !panel.hidden;
    });
    this.el('#chat-emoji-panel').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-emoji-btn');
      if (!btn) return;
      const input = this.el<HTMLTextAreaElement>('#chat-input');
      input.value += btn.dataset.emoji ?? '';
      input.focus();
      this.autoGrow();
    });

    this.el('#chat-info-close').addEventListener('click', () => this.toggleInfo(false));
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#chat-info-toggle')) this.toggleInfo();
      if (!t.closest('#chat-ctx') && !t.closest('.chat-conv')) this.el('#chat-ctx').hidden = true;
      if (!t.closest('#chat-emoji') && !t.closest('#chat-emoji-panel')) this.el('#chat-emoji-panel').hidden = true;
    });

    this.el('#chat-new').addEventListener('click', () => {
      const name = prompt('Start a conversation with…', 'New Friend');
      if (!name?.trim()) return;
      const id = `c${Date.now()}`;
      this.convs.unshift({
        id,
        name: name.trim(),
        kind: 'dm',
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        preview: 'Conversation started',
        time: 'Now',
        unread: 0,
        online: true,
        statusText: 'Online',
        messages: [{ id: `${id}-s`, from: 'system', text: 'Conversation started', time: 'Now' }],
      });
      this.filter = 'all';
      this.select(id);
    });

    this.el('#chat-attach').addEventListener('click', () => {
      const c = this.active();
      c.messages.push({
        id: `f-${Date.now()}`,
        from: 'me',
        text: 'Shared a file',
        time: 'Now',
        status: 'sent',
        type: 'file',
        fileName: 'link-clip.png',
        fileSize: '1.2 MB',
      });
      c.preview = '📎 link-clip.png';
      c.time = 'Now';
      this.renderMessages();
      this.renderList();
      showToast('Attachment added');
    });

    this.el('#chat-voice').addEventListener('click', () => {
      const c = this.active();
      c.messages.push({
        id: `v-${Date.now()}`,
        from: 'me',
        text: 'Voice message',
        time: 'Now',
        status: 'sent',
        type: 'voice',
      });
      c.preview = '🎤 Voice message';
      c.time = 'Now';
      this.renderMessages();
      this.renderList();
      showToast('Voice message sent');
    });

    this.el('#chat-messages').addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.chat-voice-play')) {
        const btn = t.closest<HTMLButtonElement>('.chat-voice-play')!;
        const playing = btn.dataset.playing === '1';
        btn.dataset.playing = playing ? '0' : '1';
        btn.textContent = playing ? '▶' : '❚❚';
        showToast(playing ? 'Voice paused' : 'Playing voice message…');
        return;
      }
      if (t.closest('.chat-file-dl')) {
        showToast('Download started (demo)');
      }
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

  private select(id: string): void {
    this.activeId = id;
    const c = this.active();
    c.unread = 0;
    c.typing = false;
    this.root.classList.add('thread-open');
    this.root.classList.remove('list-open');
    this.render();
    // Simulate occasional typing from the other side
    if (c.kind !== 'channel' && Math.random() > 0.55) {
      window.setTimeout(() => {
        if (this.activeId !== id) return;
        c.typing = true;
        this.renderTyping();
        this.renderList();
        window.setTimeout(() => {
          if (this.activeId !== id) return;
          c.typing = false;
          c.messages.push({
            id: `auto-${Date.now()}`,
            from: 'them',
            author: c.kind === 'group' ? 'NeonX' : undefined,
            text: ['Nice.', 'Link up?', 'gg', 'On my way.', 'Check the event rewards.'][Math.floor(Math.random() * 5)],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
          });
          c.preview = c.messages[c.messages.length - 1].text;
          c.time = 'Now';
          this.renderMessages();
          this.renderList();
          this.renderTyping();
        }, 1600);
      }, 900);
    }
  }

  private send(): void {
    const input = this.el<HTMLTextAreaElement>('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    const c = this.active();
    if (c.kind === 'channel') {
      // read-only feel for channels — still allow local notes as "you"
    }
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      from: 'me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
    };
    c.messages.push(msg);
    c.preview = text;
    c.time = 'Now';
    input.value = '';
    this.autoGrow();
    this.el('#chat-emoji-panel').hidden = true;
    this.renderMessages();
    this.renderList();
    window.setTimeout(() => {
      msg.status = 'sent';
      this.renderMessages();
      window.setTimeout(() => {
        msg.status = 'delivered';
        this.renderMessages();
        window.setTimeout(() => {
          msg.status = 'read';
          this.renderMessages();
        }, 500);
      }, 350);
    }, 250);
  }

  private toggleInfo(force?: boolean): void {
    this.infoOpen = force ?? !this.infoOpen;
    this.root.classList.toggle('info-collapsed', !this.infoOpen);
  }

  private openContext(x: number, y: number, id: string): void {
    const menu = this.el('#chat-ctx');
    menu.hidden = false;
    menu.innerHTML = `
      <button type="button" data-act="pin">Pin / Unpin</button>
      <button type="button" data-act="mute">Mute / Unmute</button>
      <button type="button" data-act="fav">Favorite</button>
      <button type="button" data-act="archive">Archive</button>
      <button type="button" data-act="unread">Mark unread</button>
    `;
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    menu.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.act;
      const c = this.convs.find((x) => x.id === id);
      if (!c || !act) return;
      if (act === 'pin') c.pinned = !c.pinned;
      if (act === 'mute') c.muted = !c.muted;
      if (act === 'fav') c.favorite = !c.favorite;
      if (act === 'archive') c.archived = !c.archived;
      if (act === 'unread') c.unread = Math.max(1, c.unread);
      menu.hidden = true;
      this.renderList();
    };
  }

  private render(): void {
    this.renderList();
    this.renderHead();
    this.renderMessages();
    this.renderTyping();
    this.renderInfo();
    const collapse = !this.infoOpen || window.innerWidth < 1100;
    this.root.classList.toggle('info-collapsed', collapse);
  }

  private renderList(): void {
    const list = this.el('#chat-conv-list');
    const items = this.filtered();
    if (items.length === 0) {
      list.innerHTML = `<div class="chat-empty-list">No conversations</div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const kind =
          c.kind === 'group' ? icons.users() : c.kind === 'channel' ? icons.hash() : '';
        return `
        <button type="button" class="chat-conv${c.id === this.activeId ? ' active' : ''}" data-id="${c.id}" role="listitem">
          <span class="chat-conv-avatar">
            <img src="${c.avatar}" alt="" />
            ${c.online ? '<i class="chat-online"></i>' : ''}
          </span>
          <span class="chat-conv-body">
            <span class="chat-conv-top">
              <span class="chat-conv-name">${kind ? `<span class="chat-kind">${kind}</span>` : ''}${escapeHtml(c.name)}</span>
              <span class="chat-conv-time">${escapeHtml(c.time)}</span>
            </span>
            <span class="chat-conv-bottom">
              <span class="chat-conv-preview">${c.typing ? '<em class="typing">typing…</em>' : escapeHtml(c.preview)}</span>
              <span class="chat-conv-flags">
                ${c.pinned ? `<span title="Pinned">${icons.pin()}</span>` : ''}
                ${c.muted ? `<span title="Muted">${icons.mute()}</span>` : ''}
                ${c.unread > 0 ? `<span class="chat-unread">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
              </span>
            </span>
          </span>
        </button>`;
      })
      .join('');
  }

  private renderHead(): void {
    const c = this.active();
    this.el('#chat-thread-head').innerHTML = `
      <div class="chat-thread-user">
        <button type="button" class="chat-back-mobile" id="chat-back-list" aria-label="Back to conversations">←</button>
        <span class="chat-conv-avatar lg">
          <img src="${c.avatar}" alt="" />
          ${c.online ? '<i class="chat-online"></i>' : ''}
        </span>
        <div>
          <div class="chat-thread-name">${escapeHtml(c.name)}</div>
          <div class="chat-thread-status">${escapeHtml(c.statusText ?? (c.online ? 'Online' : 'Offline'))}</div>
        </div>
      </div>
      <div class="chat-thread-actions">
        <button type="button" class="chat-tool" data-chat-act="search" title="Search in chat">${icons.search()}</button>
        <button type="button" class="chat-tool" data-chat-act="call" title="Call">${icons.phone()}</button>
        <button type="button" class="chat-tool" id="chat-info-toggle" title="Details">${icons.info()}</button>
        <button type="button" class="chat-tool" data-chat-act="more" title="More">${icons.more()}</button>
      </div>
    `;
    this.el('#chat-back-list')?.addEventListener('click', () => {
      this.root.classList.remove('thread-open');
      this.root.classList.add('list-open');
    });
    this.el('#chat-thread-head').querySelectorAll<HTMLButtonElement>('[data-chat-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.chatAct;
        if (act === 'search') {
          const q = prompt('Search in this chat…', '');
          if (q?.trim()) showToast(`No matches for “${q.trim()}”`);
          return;
        }
        if (act === 'call') {
          showToast(`Calling ${this.active().name}…`);
          return;
        }
        if (act === 'more') {
          this.openContext(btn.getBoundingClientRect().left, btn.getBoundingClientRect().bottom + 6, this.activeId);
        }
      });
    });
  }

  private renderMessages(): void {
    const c = this.active();
    const box = this.el('#chat-messages');
    const parts: string[] = ['<div class="chat-day"><span>Today</span></div>'];
    if (c.unread > 0) {
      /* unread separator for demo when first opening with unread — cleared on select */
    }
    for (const m of c.messages) {
      if (m.from === 'system') {
        parts.push(`<div class="chat-system">${escapeHtml(m.text)}</div>`);
        continue;
      }
      const mine = m.from === 'me';
      const reactions = m.reactions?.length
        ? `<div class="chat-reacts">${m.reactions.map((r) => `<span>${r.emoji} ${r.count}</span>`).join('')}</div>`
        : '';
      parts.push(`
        <article class="chat-bubble ${mine ? 'mine' : 'theirs'}" data-id="${m.id}">
          ${!mine && m.author ? `<div class="chat-author">${escapeHtml(m.author)}</div>` : ''}
          <div class="chat-bubble-body">${formatMessageBody(m)}</div>
          ${reactions}
          <div class="chat-meta">
            <span>${escapeHtml(m.time)}</span>
            ${mine ? statusTicks(m.status) : ''}
          </div>
        </article>
      `);
    }
    box.innerHTML = parts.join('');
    box.scrollTop = box.scrollHeight;
  }

  private renderTyping(): void {
    const c = this.active();
    const el = this.el('#chat-typing');
    const label = this.el('#chat-typing-label');
    el.hidden = !c.typing;
    label.textContent = c.kind === 'group' ? 'Someone is typing…' : `${c.name} is typing…`;
  }

  private renderInfo(): void {
    const c = this.active();
    this.el('#chat-info-body').innerHTML = `
      <div class="chat-info-profile">
        <img src="${c.avatar}" alt="" />
        <h4>${escapeHtml(c.name)}</h4>
        <p>${escapeHtml(c.statusText ?? '')}</p>
        <div class="chat-info-actions">
          <button type="button" data-info-act="call">${icons.phone()} Call</button>
          <button type="button" data-info-act="search">${icons.search()} Search</button>
          <button type="button" data-info-act="mute">${icons.mute()} Mute</button>
        </div>
      </div>
      <div class="chat-info-tabs" id="chat-info-tabs">
        <button type="button" class="active" data-tab="Media">Media</button>
        <button type="button" data-tab="Files">Files</button>
        <button type="button" data-tab="Links">Links</button>
        <button type="button" data-tab="Pinned">Pinned</button>
      </div>
      <div class="chat-media-grid" id="chat-info-panel-content">
        ${[0, 1, 2, 3, 4, 5]
          .map((i) => `<button type="button" class="chat-media-tile"><img src="${AVATARS[i % AVATARS.length]}" alt="" /></button>`)
          .join('')}
      </div>
      ${
        c.kind !== 'dm'
          ? `<div class="chat-members">
              <h5>${icons.users()} Members · ${c.members ?? 0}</h5>
              <ul>
                <li><img src="${AVATARS[0]}" alt="" /> ShadowLink <span>Admin</span></li>
                <li><img src="${AVATARS[1]}" alt="" /> NeonX <span>Online</span></li>
                <li><img src="${AVATARS[4]}" alt="" /> PulseFire <span></span></li>
              </ul>
            </div>`
          : `<div class="chat-about">
              <h5>About</h5>
              <p>Competitive LINK player. Neon Storm enjoyer.</p>
              <h5>Shared groups</h5>
              <p>LINK Squad · Clan War Room</p>
            </div>`
      }
    `;

    this.el('#chat-info-body').querySelectorAll<HTMLButtonElement>('[data-info-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.infoAct;
        if (act === 'call') showToast(`Calling ${c.name}…`);
        if (act === 'search') {
          const q = prompt('Search shared content…', '');
          if (q?.trim()) showToast(`Searching for “${q.trim()}”…`);
        }
        if (act === 'mute') {
          c.muted = !c.muted;
          showToast(c.muted ? `${c.name} muted` : `${c.name} unmuted`);
          this.renderList();
        }
      });
    });

    const tabsRoot = this.el('#chat-info-tabs');
    tabsRoot?.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        tabsRoot.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === tab));
        const name = tab.dataset.tab || 'Media';
        const panel = this.el('#chat-info-panel-content');
        if (name === 'Media') {
          panel.className = 'chat-media-grid';
          panel.innerHTML = [0, 1, 2, 3, 4, 5]
            .map(
              (i) =>
                `<button type="button" class="chat-media-tile"><img src="${AVATARS[i % AVATARS.length]}" alt="" /></button>`,
            )
            .join('');
          panel.querySelectorAll<HTMLButtonElement>('.chat-media-tile').forEach((tile) => {
            tile.addEventListener('click', () => showToast('Opening media preview…'));
          });
        } else if (name === 'Files') {
          panel.className = 'chat-info-list';
          panel.innerHTML = `<p>link-clip.png · 1.2 MB</p><p>match-replay.lnk · 4.8 MB</p>`;
        } else if (name === 'Links') {
          panel.className = 'chat-info-list';
          panel.innerHTML = `<p>https://link.gg/events/neon-storm</p><p>https://link.gg/patch-notes</p>`;
        } else {
          panel.className = 'chat-info-list';
          panel.innerHTML = `<p>Pinned: “Who is free for custom lobby?”</p>`;
        }
        showToast(`${name} tab`);
      });
    });

    this.el('#chat-info-body').querySelectorAll<HTMLButtonElement>('.chat-media-tile').forEach((tile) => {
      tile.addEventListener('click', () => showToast('Opening media preview…'));
    });
  }
}

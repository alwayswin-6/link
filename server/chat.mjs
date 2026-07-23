import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionUser, touchUserActivity, listUsers } from './store.mjs';
import { setUserOnline, setUserOffline, getOnlineUsers } from './presence.mjs';

const GLOBAL = 'global';
const HISTORY_LIMIT = 120;
const PERSIST_LIMIT = 2000;
const MAX_TEXT = 2000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = join(__dirname, 'data', 'chat-media');
const PERSIST_FILE = join(__dirname, 'data', 'chat-history.json');

function newId() {
  return randomBytes(8).toString('hex');
}

function dmKey(a, b) {
  return `dm:${[a, b].sort().join(':')}`;
}

function groupKey(id) {
  return `group:${id}`;
}

function isGroupId(id) {
  return String(id || '').startsWith('group:');
}

function ensureMediaDir() {
  if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true });
}

function ensureDataDir() {
  const dir = dirname(PERSIST_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Server-side chat archive (disk). Source of truth for room transcripts. */
/** @type {Map<string, object[]>} */
let archivedRooms = new Map();
/** @type {Map<string, { id: string, label: string }>} */
let roomMeta = new Map([[GLOBAL, { id: GLOBAL, label: 'LINK Lobby' }]]);
/** @type {Map<string, { id: string, name: string, members: string[], createdBy: string }>} */
let archivedGroups = new Map();

function loadArchive() {
  ensureDataDir();
  if (!existsSync(PERSIST_FILE)) return;
  try {
    const raw = JSON.parse(readFileSync(PERSIST_FILE, 'utf8'));
    const rooms = raw.rooms || {};
    const meta = raw.meta || {};
    archivedRooms = new Map(Object.entries(rooms).map(([k, v]) => [k, Array.isArray(v) ? v : []]));
    roomMeta = new Map(Object.entries(meta));
    if (!roomMeta.has(GLOBAL)) roomMeta.set(GLOBAL, { id: GLOBAL, label: 'LINK Lobby' });
    archivedGroups = new Map();
    for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
      if (!g?.id || !g?.name || !Array.isArray(g.members)) continue;
      archivedGroups.set(String(g.id), {
        id: String(g.id),
        name: String(g.name).slice(0, 40),
        members: [...new Set(g.members.map(String))],
        createdBy: String(g.createdBy || g.members[0] || ''),
      });
    }
  } catch (err) {
    console.warn('[chat] failed to load chat archive', err?.message || err);
  }
}

let persistTimer = 0;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = 0;
    try {
      ensureDataDir();
      const rooms = Object.fromEntries(archivedRooms.entries());
      const meta = Object.fromEntries(roomMeta.entries());
      const groups = [...archivedGroups.values()];
      writeFileSync(PERSIST_FILE, JSON.stringify({ rooms, meta, groups }, null, 0));
    } catch (err) {
      console.warn('[chat] archive persist failed', err?.message || err);
    }
  }, 400);
}

function archiveMessage(roomKey, msg, label) {
  if (!archivedRooms.has(roomKey)) archivedRooms.set(roomKey, []);
  const arr = archivedRooms.get(roomKey);
  arr.push({
    id: msg.id,
    from: msg.from,
    fromName: msg.fromName,
    to: msg.to,
    text: msg.text || '',
    imageUrl: msg.imageUrl || undefined,
    audioUrl: msg.audioUrl || undefined,
    stickerUrl: msg.stickerUrl || undefined,
    gifUrl: msg.gifUrl || undefined,
    durationMs: msg.durationMs || undefined,
    replyTo: msg.replyTo || undefined,
    ts: msg.ts,
  });
  if (arr.length > PERSIST_LIMIT) arr.splice(0, arr.length - PERSIST_LIMIT);
  if (label) roomMeta.set(roomKey, { id: roomKey, label });
  schedulePersist();
}

/** Last N messages for a room from the on-disk archive. */
function archiveSlice(roomKey, limit = HISTORY_LIMIT) {
  const arr = archivedRooms.get(roomKey) || [];
  return arr.slice(-Math.min(Math.max(Number(limit) || HISTORY_LIMIT, 1), PERSIST_LIMIT));
}

function archiveGroup(group) {
  archivedGroups.set(group.id, {
    id: group.id,
    name: group.name,
    members: [...group.members],
    createdBy: group.createdBy,
  });
  roomMeta.set(groupKey(group.id), { id: groupKey(group.id), label: group.name });
  schedulePersist();
}

loadArchive();

export function getChatMediaPath(fileId) {
  ensureMediaDir();
  const id = String(fileId || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!id) return null;
  const exts = [
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['gif', 'image/gif'],
    ['webm', 'audio/webm'],
    ['ogg', 'audio/ogg'],
    ['mp4', 'audio/mp4'],
    ['m4a', 'audio/mp4'],
  ];
  for (const [ext, mime] of exts) {
    const path = join(MEDIA_DIR, `${id}.${ext}`);
    if (existsSync(path)) return { path, mime };
  }
  return null;
}

export function saveChatMedia(buffer, mime = 'image/jpeg') {
  ensureMediaDir();
  const id = randomBytes(12).toString('hex');
  let ext = 'jpg';
  if (/png/i.test(mime)) ext = 'png';
  else if (/webp/i.test(mime)) ext = 'webp';
  else if (/gif/i.test(mime)) ext = 'gif';
  else if (/webm/i.test(mime)) ext = 'webm';
  else if (/ogg/i.test(mime)) ext = 'ogg';
  else if (/mp4|m4a|aac/i.test(mime)) ext = 'm4a';
  writeFileSync(join(MEDIA_DIR, `${id}.${ext}`), buffer);
  return { id, url: `/api/chat-media/${id}`, mime };
}

export function listChatRoomsForAdmin() {
  const rooms = [...roomMeta.values()].map((m) => ({
    id: m.id,
    label: m.label,
    count: (archivedRooms.get(m.id) || []).length,
  }));
  rooms.sort((a, b) => a.label.localeCompare(b.label));
  return rooms;
}

export function getChatHistoryForAdmin(roomId, limit = 500) {
  const key = String(roomId || '');
  return archiveSlice(key, Math.min(Math.max(Number(limit) || 500, 1), PERSIST_LIMIT));
}

/** Close all sockets for a user (ban/suspend). Bound after attachChat. */
let kickUserImpl = () => {};

export function kickChatUser(userId) {
  kickUserImpl(String(userId || ''));
}

/**
 * Real-time chat over WebSocket (path: /ws).
 */
export function attachChat(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  /** userId -> { user, sockets:Set<WebSocket> } */
  const socketsByUser = new Map();
  /** Live rolling window (seeded from archive). Archive on disk is source of truth. */
  const history = new Map();
  for (const key of archivedRooms.keys()) {
    history.set(key, archiveSlice(key, HISTORY_LIMIT));
  }
  if (!history.has(GLOBAL)) history.set(GLOBAL, []);
  /** groupId (without prefix) -> { id, name, members: string[], createdBy } */
  const groups = new Map(
    [...archivedGroups.entries()].map(([id, g]) => [id, { ...g, members: [...g.members] }]),
  );

  const liveHistory = (key) => {
    if (!history.has(key)) {
      history.set(key, archiveSlice(key, HISTORY_LIMIT));
    }
    return history.get(key);
  };
  /** messageId -> { from, recipientIds: string[], delivered: Set<string>, deliveredNotified: boolean } */
  const pendingReceipts = new Map();
  /** voiceRoomId -> Map<userId, { username, muted, deafened }> */
  const voiceRooms = new Map();

  const voiceMembers = (room) => {
    const m = voiceRooms.get(room);
    if (!m) return [];
    return [...m.entries()].map(([id, v]) => ({
      id,
      username: v.username,
      muted: !!v.muted,
      deafened: !!v.deafened,
    }));
  };

  const leaveVoiceAll = (userId) => {
    for (const [room, members] of voiceRooms.entries()) {
      if (!members.has(userId)) continue;
      members.delete(userId);
      for (const id of members.keys()) {
        sendToUser(id, { type: 'voice_peer_left', room, from: userId });
      }
      if (members.size === 0) voiceRooms.delete(room);
    }
  };

  kickUserImpl = (userId) => {
    leaveVoiceAll(userId);
    const e = socketsByUser.get(userId);
    if (!e) return;
    for (const s of [...e.sockets]) {
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }
    socketsByUser.delete(userId);
    setUserOffline(userId);
    broadcast({ type: 'presence', users: getOnlineUsers() });
  };

  const send = (sock, obj) => {
    if (sock.readyState === sock.OPEN) sock.send(JSON.stringify(obj));
  };

  const sendToUser = (userId, obj) => {
    const o = socketsByUser.get(userId);
    if (!o) return false;
    for (const s of o.sockets) send(s, obj);
    return true;
  };

  const broadcast = (obj, exceptUserId = null) => {
    for (const [userId, o] of socketsByUser.entries()) {
      if (exceptUserId && userId === exceptUserId) continue;
      for (const s of o.sockets) send(s, obj);
    }
  };

  const broadcastToMembers = (memberIds, obj) => {
    for (const id of memberIds) sendToUser(id, obj);
  };

  const pushHistory = (key, msg) => {
    const arr = liveHistory(key);
    arr.push(msg);
    if (arr.length > HISTORY_LIMIT) arr.splice(0, arr.length - HISTORY_LIMIT);
  };

  const publicGroupsFor = (userId) =>
    [...groups.values()]
      .filter((g) => g.members.includes(userId))
      .map((g) => ({
        id: groupKey(g.id),
        name: g.name,
        members: g.members,
        createdBy: g.createdBy,
      }));

  const directoryPayload = async () => {
    const users = await listUsers();
    return users
      .filter((u) => u.status !== 'banned')
      .map((u) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl || '',
        role: u.role === 'admin' ? 'admin' : 'user',
      }));
  };

  const roomLabel = (to, fromName) => {
    if (to === GLOBAL) return 'LINK Lobby';
    if (isGroupId(to)) {
      const g = groups.get(to.slice('group:'.length));
      return g?.name || to;
    }
    return `DM · ${fromName}`;
  };

  const trackReceipt = (out, recipientIds) => {
    const others = recipientIds.filter((id) => id !== out.from);
    pendingReceipts.set(out.id, {
      from: out.from,
      recipientIds: others,
      delivered: new Set(),
      deliveredNotified: false,
    });
  };

  const maybeNotifyDelivered = (messageId) => {
    const rec = pendingReceipts.get(messageId);
    if (!rec || rec.deliveredNotified) return;
    if (rec.recipientIds.length === 0) {
      // Nobody else online — still mark delivered for UX after a short grace, skip
      return;
    }
    const all = rec.recipientIds.every((id) => rec.delivered.has(id));
    // DM: need the peer. Group/global: at least one other recipient.
    const ok = rec.recipientIds.length === 1 ? all : rec.delivered.size >= 1;
    if (!ok) return;
    rec.deliveredNotified = true;
    sendToUser(rec.from, { type: 'receipt', id: messageId, status: 'delivered' });
  };

  wss.on('connection', async (sock, req) => {
    let token = '';
    try {
      token = new URL(req.url, 'http://localhost').searchParams.get('token') || '';
    } catch {
      token = '';
    }

    let user;
    try {
      user = await getSessionUser(token);
    } catch (err) {
      console.error('[chat] session lookup failed:', err?.message || err);
      user = null;
    }
    if (!user) {
      send(sock, { type: 'error', error: 'unauthorized' });
      sock.close();
      return;
    }
    if (user.status === 'banned' || user.status === 'suspended') {
      send(sock, { type: 'error', error: 'account_restricted' });
      sock.close();
      return;
    }
    if (sock.readyState !== sock.OPEN) return;

    let entry = socketsByUser.get(user.id);
    if (!entry) {
      entry = {
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl || '',
          role: user.role === 'admin' ? 'admin' : 'user',
        },
        sockets: new Set(),
      };
      socketsByUser.set(user.id, entry);
    } else {
      entry.user = {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role === 'admin' ? 'admin' : 'user',
      };
    }
    entry.sockets.add(sock);
    setUserOnline({ id: user.id, username: user.username });
    void touchUserActivity(user.id);

    let directory = [];
    try {
      directory = await directoryPayload();
    } catch (err) {
      console.warn('[chat] directory load failed', err?.message || err);
    }

    send(sock, {
      type: 'welcome',
      me: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role === 'admin' ? 'admin' : 'user',
      },
      users: getOnlineUsers(),
      directory,
      groups: publicGroupsFor(user.id),
      history: archiveSlice(GLOBAL, HISTORY_LIMIT),
    });
    broadcast({ type: 'presence', users: getOnlineUsers() });

    sock.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'message') {
        if (user.status === 'muted') {
          send(sock, { type: 'error', error: 'muted' });
          return;
        }
        const text = String(msg.text ?? '').slice(0, MAX_TEXT).trim();
        const imageUrl = String(msg.imageUrl ?? '').slice(0, 512).trim();
        const audioUrl = String(msg.audioUrl ?? '').slice(0, 512).trim();
        const stickerUrl = String(msg.stickerUrl ?? '').slice(0, 512).trim();
        const gifUrl = String(msg.gifUrl ?? '').slice(0, 512).trim();
        const durationMs = Math.min(Math.max(Number(msg.durationMs) || 0, 0), 180_000);
        const clientId = String(msg.clientId ?? '').slice(0, 64);
        if (!text && !imageUrl && !audioUrl && !stickerUrl && !gifUrl) return;
        if (imageUrl && !imageUrl.startsWith('/api/chat-media/') && !imageUrl.startsWith('/api/media-pack/')) return;
        if (audioUrl && !audioUrl.startsWith('/api/chat-media/')) return;
        if (stickerUrl && !stickerUrl.startsWith('/api/media-pack/')) return;
        if (gifUrl && !gifUrl.startsWith('/api/media-pack/') && !gifUrl.startsWith('/api/chat-media/')) return;

        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        if (!to) return;

        let replyTo;
        if (msg.replyTo && typeof msg.replyTo === 'object') {
          replyTo = {
            id: String(msg.replyTo.id || '').slice(0, 64),
            text: String(msg.replyTo.text || '').slice(0, 240),
            fromName: String(msg.replyTo.fromName || '').slice(0, 40),
          };
          if (!replyTo.id) replyTo = undefined;
        }

        const out = {
          type: 'message',
          id: newId(),
          clientId: clientId || undefined,
          from: user.id,
          fromName: user.username,
          to,
          text,
          imageUrl: imageUrl || undefined,
          audioUrl: audioUrl || undefined,
          stickerUrl: stickerUrl || undefined,
          gifUrl: gifUrl || undefined,
          durationMs: audioUrl ? durationMs || undefined : undefined,
          replyTo: replyTo || undefined,
          ts: Date.now(),
        };

        const label = roomLabel(to, user.username);
        let recipients = [];

        if (to === GLOBAL) {
          pushHistory(GLOBAL, out);
          archiveMessage(GLOBAL, out, label);
          recipients = [...socketsByUser.keys()];
          trackReceipt(out, recipients);
          broadcast(out);
        } else if (isGroupId(to)) {
          const gid = to.slice('group:'.length);
          const group = groups.get(gid);
          if (!group || !group.members.includes(user.id)) return;
          pushHistory(to, out);
          archiveMessage(to, out, group.name);
          recipients = group.members;
          trackReceipt(out, recipients);
          broadcastToMembers(group.members, out);
        } else {
          const key = dmKey(user.id, to);
          pushHistory(key, out);
          const peerName = socketsByUser.get(to)?.user?.username || to;
          archiveMessage(key, out, `DM · ${user.username} ↔ ${peerName}`);
          recipients = [user.id, to];
          trackReceipt(out, recipients);
          sendToUser(to, out);
          sendToUser(user.id, out);
        }

        // Service-center ack → single check
        send(sock, {
          type: 'message_ack',
          clientId: clientId || undefined,
          id: out.id,
          ts: out.ts,
          to,
        });

        // If no other online recipients, treat as delivered after broadcast to empty set
        const othersOnline = recipients.filter((id) => id !== user.id && socketsByUser.has(id));
        if (othersOnline.length === 0) {
          // Offline peer: still show single check only (sent to server)
        }
      } else if (msg.type === 'receipt') {
        const id = String(msg.id ?? '');
        const status = String(msg.status ?? '');
        if (!id || status !== 'delivered') return;
        const rec = pendingReceipts.get(id);
        if (!rec) return;
        if (rec.from === user.id) return;
        if (!rec.recipientIds.includes(user.id) && !rec.recipientIds.length) {
          // allow any non-sender for global
        }
        // For global, recipientIds includes everyone; for DM must be the peer
        if (rec.recipientIds.length && !rec.recipientIds.includes(user.id)) return;
        rec.delivered.add(user.id);
        maybeNotifyDelivered(id);
      } else if (msg.type === 'typing') {
        if (user.status === 'muted') return;
        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        if (!to) return;
        const payload = { type: 'typing', from: user.id, fromName: user.username, to };
        if (to === GLOBAL) broadcast(payload, user.id);
        else if (isGroupId(to)) {
          const group = groups.get(to.slice('group:'.length));
          if (!group || !group.members.includes(user.id)) return;
          for (const id of group.members) {
            if (id !== user.id) sendToUser(id, payload);
          }
        } else sendToUser(to, payload);
      } else if (msg.type === 'history') {
        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        let key = to;
        if (to !== GLOBAL && !isGroupId(to)) key = dmKey(user.id, to);
        if (isGroupId(to)) {
          const group = groups.get(to.slice('group:'.length));
          if (!group || !group.members.includes(user.id)) {
            send(sock, { type: 'history', to, messages: [] });
            return;
          }
        }
        // Serve from disk archive so history survives server restarts.
        const messages = archiveSlice(key, HISTORY_LIMIT);
        liveHistory(key);
        send(sock, { type: 'history', to, messages });
      } else if (msg.type === 'create_group') {
        const name = String(msg.name ?? '')
          .trim()
          .slice(0, 40);
        if (name.length < 2) {
          send(sock, { type: 'error', error: 'Group name too short' });
          return;
        }
        const memberIds = Array.isArray(msg.members)
          ? [...new Set(msg.members.map(String).filter((id) => id && id !== user.id))]
          : [];
        const members = [user.id, ...memberIds.slice(0, 48)];
        const id = newId();
        const group = { id, name, members, createdBy: user.id };
        groups.set(id, group);
        history.set(groupKey(id), []);
        archiveGroup(group);
        const payload = {
          type: 'group_created',
          group: { id: groupKey(id), name, members, createdBy: user.id },
        };
        broadcastToMembers(members, payload);
      } else if (msg.type === 'search') {
        const q = String(msg.query ?? '')
          .trim()
          .toLowerCase();
        void (async () => {
          let dir = [];
          try {
            dir = await directoryPayload();
          } catch {
            dir = [];
          }
          const people = dir
            .filter((u) => u.id !== user.id && (!q || u.username.toLowerCase().includes(q)))
            .slice(0, 40)
            .map((u) => ({
              id: u.id,
              name: u.username,
              kind: 'dm',
              online: !!socketsByUser.has(u.id),
              avatarUrl: u.avatarUrl || '',
            }));
          const groupHits = [...groups.values()]
            .filter((g) => !q || g.name.toLowerCase().includes(q))
            .slice(0, 20)
            .map((g) => ({
              id: groupKey(g.id),
              name: g.name,
              kind: 'group',
              online: g.members.some((m) => socketsByUser.has(m)),
              members: g.members.length,
              joined: g.members.includes(user.id),
            }));
          send(sock, { type: 'search_results', query: msg.query ?? '', people, groups: groupHits });
        })();
      } else if (msg.type === 'join_group') {
        const to = String(msg.id ?? '');
        if (!isGroupId(to)) return;
        const gid = to.slice('group:'.length);
        const group = groups.get(gid);
        if (!group) {
          send(sock, { type: 'error', error: 'Group not found' });
          return;
        }
        if (!group.members.includes(user.id)) {
          group.members.push(user.id);
        }
        send(sock, {
          type: 'group_created',
          group: { id: groupKey(group.id), name: group.name, members: group.members, createdBy: group.createdBy },
        });
        broadcastToMembers(
          group.members.filter((id) => id !== user.id),
          {
            type: 'group_created',
            group: { id: groupKey(group.id), name: group.name, members: group.members, createdBy: group.createdBy },
          },
        );
      } else if (msg.type === 'voice_join') {
        const room = String(msg.room ?? '').slice(0, 128);
        if (!room.startsWith('voice:')) return;
        leaveVoiceAll(user.id);
        if (!voiceRooms.has(room)) voiceRooms.set(room, new Map());
        const members = voiceRooms.get(room);
        const peer = { username: user.username, muted: false, deafened: false };
        const others = voiceMembers(room);
        members.set(user.id, peer);
        send(sock, { type: 'voice_peers', room, peers: others });
        for (const id of members.keys()) {
          if (id === user.id) continue;
          sendToUser(id, {
            type: 'voice_peer_joined',
            room,
            peer: { id: user.id, username: user.username, muted: false, deafened: false },
          });
        }
      } else if (msg.type === 'voice_leave') {
        const room = String(msg.room ?? '').slice(0, 128);
        const members = voiceRooms.get(room);
        if (!members?.has(user.id)) return;
        members.delete(user.id);
        for (const id of members.keys()) {
          sendToUser(id, { type: 'voice_peer_left', room, from: user.id });
        }
        if (members.size === 0) voiceRooms.delete(room);
      } else if (msg.type === 'voice_state') {
        const room = String(msg.room ?? '').slice(0, 128);
        const members = voiceRooms.get(room);
        const entry = members?.get(user.id);
        if (!entry) return;
        entry.muted = !!msg.muted;
        entry.deafened = !!msg.deafened;
        for (const id of members.keys()) {
          if (id === user.id) continue;
          sendToUser(id, {
            type: 'voice_state',
            room,
            from: user.id,
            muted: entry.muted,
            deafened: entry.deafened,
          });
        }
      } else if (msg.type === 'voice_signal') {
        const room = String(msg.room ?? '').slice(0, 128);
        const to = String(msg.to ?? '');
        const members = voiceRooms.get(room);
        if (!members?.has(user.id) || !members.has(to)) return;
        sendToUser(to, {
          type: 'voice_signal',
          room,
          from: user.id,
          fromName: user.username,
          payload: msg.payload,
        });
      }
    });

    sock.on('close', () => {
      const e = socketsByUser.get(user.id);
      if (!e) return;
      e.sockets.delete(sock);
      if (e.sockets.size === 0) {
        leaveVoiceAll(user.id);
        socketsByUser.delete(user.id);
        setUserOffline(user.id);
      }
      broadcast({ type: 'presence', users: getOnlineUsers() });
    });

    sock.on('error', () => {
      /* ignore transport errors; close handler cleans up */
    });
  });

  return wss;
}

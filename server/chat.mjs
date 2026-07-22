import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import { getSessionUser, touchUserActivity } from './store.mjs';
import { setUserOnline, setUserOffline, getOnlineUsers } from './presence.mjs';

const GLOBAL = 'global';
const HISTORY_LIMIT = 100;
const MAX_TEXT = 2000;

function newId() {
  return randomBytes(8).toString('hex');
}

function dmKey(a, b) {
  return `dm:${[a, b].sort().join(':')}`;
}

/**
 * Real-time chat over WebSocket (path: /ws).
 * - Presence: broadcasts the list of currently connected users.
 * - Global "LINK Lobby" room every signed-in user shares.
 * - Direct messages routed between two users.
 * Auth: connect with ?token=<session token>. Unauthenticated sockets are closed.
 */
export function attachChat(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  /** userId -> { user, sockets:Set<WebSocket> } */
  const socketsByUser = new Map();
  /** roomKey -> ChatMessage[] */
  const history = new Map([[GLOBAL, []]]);

  const send = (sock, obj) => {
    if (sock.readyState === sock.OPEN) sock.send(JSON.stringify(obj));
  };

  const sendToUser = (userId, obj) => {
    const o = socketsByUser.get(userId);
    if (!o) return;
    for (const s of o.sockets) send(s, obj);
  };

  const broadcast = (obj, exceptUserId = null) => {
    for (const [userId, o] of socketsByUser.entries()) {
      if (exceptUserId && userId === exceptUserId) continue;
      for (const s of o.sockets) send(s, obj);
    }
  };

  const pushHistory = (key, msg) => {
    let arr = history.get(key);
    if (!arr) {
      arr = [];
      history.set(key, arr);
    }
    arr.push(msg);
    if (arr.length > HISTORY_LIMIT) arr.splice(0, arr.length - HISTORY_LIMIT);
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
      entry = { user: { id: user.id, username: user.username }, sockets: new Set() };
      socketsByUser.set(user.id, entry);
    }
    entry.sockets.add(sock);
    setUserOnline({ id: user.id, username: user.username });
    void touchUserActivity(user.id);

    send(sock, {
      type: 'welcome',
      me: { id: user.id, username: user.username },
      users: getOnlineUsers(),
      history: history.get(GLOBAL).slice(-HISTORY_LIMIT),
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
        const text = String(msg.text ?? '').slice(0, MAX_TEXT).trim();
        if (!text) return;
        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        if (!to) return;
        const out = {
          type: 'message',
          id: newId(),
          from: user.id,
          fromName: user.username,
          to,
          text,
          ts: Date.now(),
        };
        if (to === GLOBAL) {
          pushHistory(GLOBAL, out);
          broadcast(out);
        } else {
          pushHistory(dmKey(user.id, to), out);
          sendToUser(to, out);
          sendToUser(user.id, out); // echo to all of sender's tabs
        }
      } else if (msg.type === 'typing') {
        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        if (!to) return;
        const payload = { type: 'typing', from: user.id, fromName: user.username, to };
        if (to === GLOBAL) broadcast(payload, user.id);
        else sendToUser(to, payload);
      } else if (msg.type === 'history') {
        const to = msg.to === GLOBAL ? GLOBAL : String(msg.to ?? '');
        const key = to === GLOBAL ? GLOBAL : dmKey(user.id, to);
        send(sock, { type: 'history', to, messages: (history.get(key) ?? []).slice(-HISTORY_LIMIT) });
      }
    });

    sock.on('close', () => {
      const e = socketsByUser.get(user.id);
      if (!e) return;
      e.sockets.delete(sock);
      if (e.sockets.size === 0) {
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

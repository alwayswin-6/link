/**
 * Shared live-presence registry (chat WebSocket + admin online counts).
 * In-memory only — resets on process restart; last_seen covers recent activity.
 */

/** @type {Map<string, { id: string, username: string, connectedAt: number }>} */
const online = new Map();

export function setUserOnline(user) {
  if (!user?.id) return;
  online.set(user.id, {
    id: user.id,
    username: user.username,
    connectedAt: Date.now(),
  });
}

export function setUserOffline(userId) {
  online.delete(userId);
}

export function getOnlineUsers() {
  return [...online.values()].map((u) => ({ id: u.id, username: u.username }));
}

export function getOnlineIds() {
  return new Set(online.keys());
}

export function isUserOnline(userId) {
  return online.has(userId);
}

export function onlineCount() {
  return online.size;
}

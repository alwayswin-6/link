import { Router } from 'express';
import {
  appendAudit,
  findUserById,
  getSessionUser,
  listUsers,
  publicUser,
  updateUserAdmin,
  destroySessionsForUser,
} from './store.mjs';
import { kickChatUser } from './chat.mjs';

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

/** Player-ADMIN moderation APIs (not the SUPER ADMIN /admin console). */
export function createModRouter() {
  const router = Router();

  async function requirePlayerAdmin(req, res, next) {
    try {
      const user = await getSessionUser(bearer(req));
      if (!user) return res.status(401).json({ ok: false, error: 'Not signed in.' });
      if (user.status === 'banned' || user.status === 'suspended') {
        return res.status(403).json({ ok: false, error: 'Account restricted.' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin privileges required.' });
      }
      req.modUser = user;
      next();
    } catch (err) {
      console.error('[mod/auth]', err);
      return res.status(500).json({ ok: false, error: 'Auth failed.' });
    }
  }

  router.use(requirePlayerAdmin);

  router.get('/users', async (req, res) => {
    try {
      const q = String(req.query.q || '')
        .trim()
        .toLowerCase();
      let users = await listUsers();
      users = users.filter((u) => u.status !== 'banned' || q);
      if (q) {
        users = users.filter((u) => `${u.username} ${u.email} ${u.id}`.toLowerCase().includes(q));
      }
      users = users.slice(0, 80).map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        status: u.status || 'active',
        role: u.role === 'admin' ? 'admin' : 'user',
        avatarUrl: u.avatarUrl || '',
      }));
      return res.json({ ok: true, users });
    } catch (err) {
      console.error('[mod/users]', err);
      return res.status(500).json({ ok: false, error: 'Could not load users.' });
    }
  });

  router.post('/users/:id/status', async (req, res) => {
    try {
      const target = await findUserById(req.params.id);
      if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
      if (target.id === req.modUser.id) {
        return res.status(400).json({ ok: false, error: 'You cannot moderate yourself.' });
      }
      if (target.role === 'admin') {
        return res.status(403).json({ ok: false, error: 'ADMINs cannot moderate other ADMINs.' });
      }
      const status = String(req.body?.status || '');
      if (!['active', 'banned', 'suspended', 'muted'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status.' });
      }
      const reason = String(req.body?.reason || status).slice(0, 200);
      const updated = await updateUserAdmin(target.id, { status });
      await appendAudit({
        admin: `player-admin:${req.modUser.username}`,
        action: 'MOD_STATUS',
        target: target.username,
        reason,
        ip: clientIp(req),
      });
      if (status === 'banned' || status === 'suspended') {
        await destroySessionsForUser(target.id);
        kickChatUser(target.id);
      }
      return res.json({
        ok: true,
        user: {
          id: updated.id,
          username: updated.username,
          status: updated.status,
          role: updated.role === 'admin' ? 'admin' : 'user',
        },
      });
    } catch (err) {
      console.error('[mod/status]', err);
      return res.status(500).json({ ok: false, error: 'Could not update user.' });
    }
  });

  router.get('/me', async (req, res) => {
    return res.json({ ok: true, user: publicUser(req.modUser) });
  });

  return router;
}

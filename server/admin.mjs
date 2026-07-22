import { Router } from 'express';
import multer from 'multer';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import {
  saveUpload,
  listUploads,
  deleteUpload,
  listUsers,
  adminUser,
  updateUserAdmin,
  getAdminStats,
  getAnalytics,
  appendAudit,
  listAudit,
  listReports,
  updateReport,
  createReport,
  listAnnouncements,
  createAnnouncement,
  getSettings,
  updateSettings,
  findUserById,
} from './store.mjs';
import { getOnlineIds, getOnlineUsers, onlineCount } from './presence.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED_FILE = join(ROOT, 'src', 'admin', 'generated', 'admin-seed.json');

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** token -> { email, role, displayName, expiresAt } */
const adminSessions = new Map();

function loadSeed() {
  if (!existsSync(SEED_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SEED_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function verifyAdmin(email, password) {
  const seed = loadSeed();
  if (!seed) return null;
  if (String(email).trim().toLowerCase() !== String(seed.email).toLowerCase()) return null;
  const salt = Buffer.from(seed.salt, 'base64');
  const expected = Buffer.from(seed.hash, 'base64');
  const actual = pbkdf2Sync(password, salt, seed.iterations, expected.length, 'sha256');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { email: seed.email, role: seed.role, displayName: seed.displayName };
}

function issueAdminToken(admin) {
  const token = randomBytes(32).toString('hex');
  adminSessions.set(token, { ...admin, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS });
  return token;
}

function currentAdmin(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const token = m?.[1];
  if (!token) return null;
  const s = adminSessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    adminSessions.delete(token);
    return null;
  }
  return s;
}

function requireAdmin(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin authentication required.' });
  req.admin = admin;
  next();
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

async function audit(req, action, target = '', reason = '') {
  return appendAudit({
    admin: req.admin?.email || 'admin',
    action,
    target,
    reason,
    ip: clientIp(req),
  });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

/** Router for the private admin control plane (mounted at /api/admin). */
export function createAdminRouter() {
  const router = Router();

  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' });
    }
    if (!loadSeed()) {
      return res.status(503).json({ ok: false, error: 'Admin is not configured on the server.' });
    }
    const admin = verifyAdmin(email, password);
    if (!admin) return res.status(401).json({ ok: false, error: 'Invalid administrator credentials.' });
    const token = issueAdminToken(admin);
    return res.json({
      ok: true,
      token,
      admin: { email: admin.email, role: admin.role, displayName: admin.displayName },
    });
  });

  router.post('/logout', requireAdmin, (req, res) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (m) adminSessions.delete(m[1]);
    return res.json({ ok: true });
  });

  router.get('/me', requireAdmin, (req, res) => {
    return res.json({
      ok: true,
      admin: {
        email: req.admin.email,
        role: req.admin.role,
        displayName: req.admin.displayName,
      },
    });
  });

  router.get('/stats', requireAdmin, async (_req, res) => {
    try {
      const stats = await getAdminStats(getOnlineIds());
      return res.json({
        ok: true,
        stats: { ...stats, liveConnections: onlineCount() },
        online: getOnlineUsers(),
      });
    } catch (err) {
      console.error('[admin/stats]', err);
      return res.status(500).json({ ok: false, error: 'Could not load stats.' });
    }
  });

  router.get('/analytics', requireAdmin, async (_req, res) => {
    try {
      const analytics = await getAnalytics(getOnlineIds());
      return res.json({ ok: true, analytics });
    } catch (err) {
      console.error('[admin/analytics]', err);
      return res.status(500).json({ ok: false, error: 'Could not load analytics.' });
    }
  });

  router.get('/users', requireAdmin, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      const status = String(req.query.status || 'all');
      const onlineIds = getOnlineIds();
      let users = (await listUsers()).map((u) => adminUser(u, { onlineIds }));

      if (status === 'online') users = users.filter((u) => u.status === 'online');
      else if (status === 'offline') users = users.filter((u) => u.status === 'offline');
      else if (status === 'banned') users = users.filter((u) => u.accountStatus === 'banned' || u.status === 'banned');
      else if (status === 'muted') users = users.filter((u) => u.accountStatus === 'muted' || u.status === 'muted');
      else if (status === 'suspended') users = users.filter((u) => u.accountStatus === 'suspended');
      else if (status === 'recent') {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        users = users.filter((u) => Date.parse(u.registered) > weekAgo || Date.parse(String(u.lastSeen || 0)) > weekAgo);
      }

      if (q) {
        users = users.filter((u) =>
          `${u.id} ${u.username} ${u.email} ${u.country} ${u.password} ${u.ip} ${u.status}`
            .toLowerCase()
            .includes(q),
        );
      }

      return res.json({ ok: true, users, total: users.length });
    } catch (err) {
      console.error('[admin/users]', err);
      return res.status(500).json({ ok: false, error: 'Could not load users.' });
    }
  });

  router.get('/users/:id', requireAdmin, async (req, res) => {
    try {
      const user = await findUserById(req.params.id);
      if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
      return res.json({ ok: true, user: adminUser(user, { onlineIds: getOnlineIds() }) });
    } catch (err) {
      console.error('[admin/users:get]', err);
      return res.status(500).json({ ok: false, error: 'Could not load user.' });
    }
  });

  router.patch('/users/:id', requireAdmin, async (req, res) => {
    try {
      const body = req.body ?? {};
      const updated = await updateUserAdmin(req.params.id, {
        status: body.status,
        country: body.country,
        notes: body.notes,
        username: body.username,
        password: body.password,
      });
      if (!updated) return res.status(404).json({ ok: false, error: 'User not found.' });
      await audit(
        req,
        body.password ? 'SET_PASSWORD' : 'UPDATE_USER',
        updated.username,
        body.reason || body.status || 'profile update',
      );
      return res.json({ ok: true, user: adminUser(updated, { onlineIds: getOnlineIds() }) });
    } catch (err) {
      console.error('[admin/users:patch]', err);
      return res.status(500).json({ ok: false, error: 'Could not update user.' });
    }
  });

  router.get('/online', requireAdmin, (_req, res) => {
    return res.json({ ok: true, users: getOnlineUsers(), count: onlineCount() });
  });

  router.get('/audit', requireAdmin, async (_req, res) => {
    try {
      return res.json({ ok: true, entries: await listAudit(300) });
    } catch (err) {
      console.error('[admin/audit]', err);
      return res.status(500).json({ ok: false, error: 'Could not load audit log.' });
    }
  });

  router.get('/reports', requireAdmin, async (_req, res) => {
    try {
      return res.json({ ok: true, reports: await listReports() });
    } catch (err) {
      console.error('[admin/reports]', err);
      return res.status(500).json({ ok: false, error: 'Could not load reports.' });
    }
  });

  router.post('/reports', requireAdmin, async (req, res) => {
    try {
      const row = await createReport(req.body ?? {});
      await audit(req, 'CREATE_REPORT', row.target, row.category);
      return res.status(201).json({ ok: true, report: row });
    } catch (err) {
      console.error('[admin/reports:create]', err);
      return res.status(500).json({ ok: false, error: 'Could not create report.' });
    }
  });

  router.patch('/reports/:id', requireAdmin, async (req, res) => {
    try {
      const status = req.body?.status === 'rejected' ? 'rejected' : 'resolved';
      const row = await updateReport(req.params.id, status, String(req.body?.note || ''));
      if (!row) return res.status(404).json({ ok: false, error: 'Report not found.' });
      await audit(req, status === 'resolved' ? 'RESOLVE_REPORT' : 'REJECT_REPORT', row.id, row.category);
      return res.json({ ok: true, report: row });
    } catch (err) {
      console.error('[admin/reports:patch]', err);
      return res.status(500).json({ ok: false, error: 'Could not update report.' });
    }
  });

  router.get('/announcements', requireAdmin, async (_req, res) => {
    try {
      return res.json({ ok: true, announcements: await listAnnouncements() });
    } catch (err) {
      console.error('[admin/announcements]', err);
      return res.status(500).json({ ok: false, error: 'Could not load announcements.' });
    }
  });

  router.post('/announcements', requireAdmin, async (req, res) => {
    try {
      const row = await createAnnouncement({
        title: req.body?.title,
        body: req.body?.body,
        audience: req.body?.audience,
        publishedBy: req.admin.email,
      });
      if (!row) return res.status(400).json({ ok: false, error: 'Title is required.' });
      await audit(req, 'PUBLISH_ANNOUNCEMENT', row.audience, row.title);
      return res.status(201).json({ ok: true, announcement: row });
    } catch (err) {
      console.error('[admin/announcements:create]', err);
      return res.status(500).json({ ok: false, error: 'Could not publish announcement.' });
    }
  });

  router.get('/settings', requireAdmin, async (_req, res) => {
    try {
      return res.json({ ok: true, settings: await getSettings() });
    } catch (err) {
      console.error('[admin/settings]', err);
      return res.status(500).json({ ok: false, error: 'Could not load settings.' });
    }
  });

  router.patch('/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await updateSettings(req.body ?? {});
      await audit(req, 'UPDATE_SETTINGS', 'system', JSON.stringify(req.body ?? {}));
      return res.json({ ok: true, settings });
    } catch (err) {
      console.error('[admin/settings:patch]', err);
      return res.status(500).json({ ok: false, error: 'Could not update settings.' });
    }
  });

  router.get('/uploads', requireAdmin, async (_req, res) => {
    try {
      const files = await listUploads();
      return res.json({ ok: true, files: files.map((f) => ({ ...f, url: `/f/${f.id}` })) });
    } catch (err) {
      console.error('[admin/uploads:list]', err);
      return res.status(500).json({ ok: false, error: 'Could not list files.' });
    }
  });

  router.post('/uploads', requireAdmin, (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 25 MB limit.' : 'Upload failed.';
        return res.status(400).json({ ok: false, error: msg });
      }
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file provided.' });
      try {
        const saved = await saveUpload({
          filename: req.file.originalname || 'file',
          mime: req.file.mimetype || 'application/octet-stream',
          size: req.file.size,
          data: req.file.buffer,
          uploadedBy: req.admin?.email ?? null,
        });
        await audit(req, 'UPLOAD_FILE', saved.filename, `${saved.size} bytes`);
        return res.status(201).json({ ok: true, file: { ...saved, url: `/f/${saved.id}` } });
      } catch (e) {
        console.error('[admin/uploads:save]', e);
        return res.status(500).json({ ok: false, error: 'Could not store the file.' });
      }
    });
  });

  router.delete('/uploads/:id', requireAdmin, async (req, res) => {
    try {
      const ok = await deleteUpload(req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: 'File not found.' });
      await audit(req, 'DELETE_FILE', req.params.id, 'removed from file manager');
      return res.json({ ok: true });
    } catch (err) {
      console.error('[admin/uploads:delete]', err);
      return res.status(500).json({ ok: false, error: 'Could not delete the file.' });
    }
  });

  return router;
}

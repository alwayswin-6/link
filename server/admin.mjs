import { Router } from 'express';
import multer from 'multer';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { saveUpload, listUploads, deleteUpload } from './store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED_FILE = join(ROOT, 'src', 'admin', 'generated', 'admin-seed.json');

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** token -> { email, role, expiresAt } */
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
    return res.json({ ok: true, token, admin: { email: admin.email, role: admin.role } });
  });

  router.post('/logout', requireAdmin, (req, res) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (m) adminSessions.delete(m[1]);
    return res.json({ ok: true });
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
      return res.json({ ok: true });
    } catch (err) {
      console.error('[admin/uploads:delete]', err);
      return res.status(500).json({ ok: false, error: 'Could not delete the file.' });
    }
  });

  return router;
}

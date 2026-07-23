import { Router } from 'express';
import multer from 'multer';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import {
  listCosmetics,
  saveCosmetic,
  deleteCosmetic,
  getCosmeticFilePath,
  getCosmetic,
  listMediaPack,
  saveMediaPackItem,
  deleteMediaPackItem,
  getMediaPackFilePath,
  getUserEquipped,
  setUserEquipped,
  getEquippedResolved,
  getSessionUser,
} from './store.mjs';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

function mimeFromExt(path) {
  const e = extname(path).toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  if (e === '.zip') return 'application/zip';
  if (e === '.json') return 'application/json';
  return 'application/octet-stream';
}

function bearerUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  return m?.[1] || '';
}

/**
 * Public + auth cosmetics / media-pack routes.
 * Admin upload routes are mounted separately with admin auth.
 */
export function createCosmeticsPublicRouter() {
  const router = Router();

  router.get('/cosmetics', async (req, res) => {
    try {
      const kind = req.query.kind ? String(req.query.kind) : '';
      const items = await listCosmetics(kind || undefined);
      return res.json({
        ok: true,
        items: items.map(({ previewFile, assetFile, ...rest }) => rest),
      });
    } catch (err) {
      console.error('[cosmetics:list]', err);
      return res.status(500).json({ ok: false, error: 'Could not list cosmetics.' });
    }
  });

  router.get('/cosmetics/file/:name', (req, res) => {
    const path = getCosmeticFilePath(req.params.name);
    if (!path || !existsSync(path)) return res.status(404).json({ ok: false, error: 'Not found.' });
    res.setHeader('Content-Type', mimeFromExt(path));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return createReadStream(path).pipe(res);
  });

  router.get('/cosmetics/equipped/:userId', async (req, res) => {
    try {
      const resolved = await getEquippedResolved(String(req.params.userId));
      return res.json({ ok: true, ...resolved });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not load equipped cosmetics.' });
    }
  });

  router.get('/cosmetics/me', async (req, res) => {
    try {
      const token = bearerUser(req);
      const user = token ? await getSessionUser(token) : null;
      if (!user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
      const resolved = await getEquippedResolved(user.id);
      return res.json({ ok: true, ...resolved });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not load cosmetics.' });
    }
  });

  router.post('/cosmetics/equip', async (req, res) => {
    try {
      const token = bearerUser(req);
      const user = token ? await getSessionUser(token) : null;
      if (!user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
      const body = req.body || {};
      const kind = String(body.kind || '');
      const id = String(body.id || '');
      if (!['nameplate', 'frame', 'effect'].includes(kind)) {
        return res.status(400).json({ ok: false, error: 'Invalid kind.' });
      }
      if (id) {
        const item = await getCosmetic(id);
        if (!item || item.kind !== kind) return res.status(404).json({ ok: false, error: 'Item not found.' });
      }
      const patch = {};
      if (kind === 'nameplate') patch.nameplateId = id;
      if (kind === 'frame') patch.frameId = id;
      if (kind === 'effect') patch.effectId = id;
      const equipped = await setUserEquipped(user.id, patch);
      const resolved = await getEquippedResolved(user.id);
      return res.json({ ok: true, equipped, ...resolved });
    } catch (err) {
      console.error('[cosmetics:equip]', err);
      return res.status(500).json({ ok: false, error: 'Could not equip item.' });
    }
  });

  router.get('/media-pack', async (req, res) => {
    try {
      const kind = req.query.kind ? String(req.query.kind) : '';
      const items = await listMediaPack(kind || undefined);
      return res.json({
        ok: true,
        items: items.map(({ previewFile, assetFile, ...rest }) => rest),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not list media pack.' });
    }
  });

  router.get('/media-pack/file/:name', (req, res) => {
    const path = getMediaPackFilePath(req.params.name);
    if (!path || !existsSync(path)) return res.status(404).json({ ok: false, error: 'Not found.' });
    res.setHeader('Content-Type', mimeFromExt(path));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return createReadStream(path).pipe(res);
  });

  return router;
}

/** Admin-only dual upload (preview + downloadable asset). */
export function attachCosmeticsAdminRoutes(router, { requireAdmin, requireSuperAdmin, audit }) {
  const dual = upload.fields([
    { name: 'preview', maxCount: 1 },
    { name: 'asset', maxCount: 1 },
  ]);

  router.get('/cosmetics', requireAdmin, async (req, res) => {
    try {
      const items = await listCosmetics(req.query.kind ? String(req.query.kind) : undefined);
      return res.json({ ok: true, items });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not list cosmetics.' });
    }
  });

  router.post('/cosmetics', requireSuperAdmin, (req, res) => {
    dual(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: 'Upload failed.' });
      const preview = req.files?.preview?.[0];
      const asset = req.files?.asset?.[0];
      if (!preview || !asset) {
        return res.status(400).json({ ok: false, error: 'Both preview image and asset file are required.' });
      }
      try {
        const saved = await saveCosmetic({
          kind: String(req.body.kind || 'frame'),
          name: String(req.body.name || preview.originalname || 'Cosmetic'),
          previewBuf: preview.buffer,
          previewMime: preview.mimetype,
          assetBuf: asset.buffer,
          assetMime: asset.mimetype,
          uploadedBy: req.admin?.email ?? null,
        });
        await audit(req, 'UPLOAD_COSMETIC', saved.name, saved.kind);
        return res.status(201).json({ ok: true, item: saved });
      } catch (e) {
        console.error('[admin/cosmetics]', e);
        return res.status(500).json({ ok: false, error: 'Could not store cosmetic.' });
      }
    });
  });

  router.delete('/cosmetics/:id', requireSuperAdmin, async (req, res) => {
    try {
      const ok = await deleteCosmetic(req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: 'Not found.' });
      await audit(req, 'DELETE_COSMETIC', req.params.id, '');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not delete.' });
    }
  });

  router.get('/media-pack', requireAdmin, async (req, res) => {
    try {
      const items = await listMediaPack(req.query.kind ? String(req.query.kind) : undefined);
      return res.json({ ok: true, items });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not list media pack.' });
    }
  });

  router.post('/media-pack', requireSuperAdmin, (req, res) => {
    dual(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: 'Upload failed.' });
      const preview = req.files?.preview?.[0];
      const asset = req.files?.asset?.[0];
      if (!preview || !asset) {
        return res.status(400).json({ ok: false, error: 'Both preview and asset are required.' });
      }
      try {
        const saved = await saveMediaPackItem({
          kind: String(req.body.kind || 'sticker'),
          name: String(req.body.name || preview.originalname || 'Media'),
          previewBuf: preview.buffer,
          previewMime: preview.mimetype,
          assetBuf: asset.buffer,
          assetMime: asset.mimetype,
          uploadedBy: req.admin?.email ?? null,
        });
        await audit(req, 'UPLOAD_MEDIA_PACK', saved.name, saved.kind);
        return res.status(201).json({ ok: true, item: saved });
      } catch (e) {
        return res.status(500).json({ ok: false, error: 'Could not store media.' });
      }
    });
  });

  router.delete('/media-pack/:id', requireSuperAdmin, async (req, res) => {
    try {
      const ok = await deleteMediaPackItem(req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: 'Not found.' });
      await audit(req, 'DELETE_MEDIA_PACK', req.params.id, '');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Could not delete.' });
    }
  });
}

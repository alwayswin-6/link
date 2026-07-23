import { Router } from 'express';
import {
  createSession,
  destroySession,
  findUserByEmail,
  findUserByUsername,
  getSessionUser,
  getSettings,
  publicUser,
  registerUserDirect,
  touchUserActivity,
  updateUserAdmin,
  verifyPassword,
} from './store.mjs';
import { registerOAuthRoutes } from './oauth.mjs';
import { resolveClientGeo } from './geo.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? req.body?.token ?? null;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

function validateRegister({ email, username, password }) {
  if (!email || !EMAIL_RE.test(email)) return 'Enter a valid email address.';
  if (!username || username.trim().length < 2) return 'Name must be at least 2 characters.';
  if (username.trim().length > 24) return 'Name must be 24 characters or fewer.';
  if (!/^[a-zA-Z0-9_ ]+$/.test(username.trim())) {
    return 'Name may only contain letters, numbers, spaces, and underscores.';
  }
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  return null;
}

function providerFromEmail(email) {
  if (/@(gmail|googlemail)\.com$/i.test(email)) return 'gmail';
  if (/@(outlook|hotmail|live|msn)\.com$/i.test(email)) return 'outlook';
  return 'email';
}

/** mailer arg kept for call-site compatibility; SMTP is no longer used for signup. */
export function createAuthRouter(_mailer = null) {
  const router = Router();
  registerOAuthRoutes(router);

  /**
   * Direct registration — creates the account immediately (no OTP / SMTP).
   * Country is detected from the client IP for the admin console.
   */
  async function handleRegister(req, res) {
    try {
      const settings = await getSettings();
      if (settings.registration === false) {
        return res.status(403).json({ ok: false, error: 'Registration is currently closed.' });
      }
      if (settings.maintenance) {
        return res.status(503).json({ ok: false, error: 'Platform is in maintenance mode.' });
      }

      const { email, username, password, name } = req.body ?? {};
      const displayName = String(name || username || '').trim();
      const error = validateRegister({ email, username: displayName, password });
      if (error) return res.status(400).json({ ok: false, error });

      const uname = displayName.replace(/\s+/g, '_');
      if (await findUserByEmail(email)) {
        return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
      }
      if (await findUserByUsername(uname)) {
        return res.status(409).json({ ok: false, error: 'That name is already taken.' });
      }

      const geo = await resolveClientGeo(req);
      const result = await registerUserDirect({
        email,
        username: uname,
        password,
        provider: providerFromEmail(email),
        country: geo.country,
        ip: geo.ip || clientIp(req),
      });
      if (!result.ok) {
        return res.status(409).json(result);
      }

      const token = await createSession(result.user.id);
      return res.status(201).json({
        ok: true,
        message: 'Account created.',
        token,
        user: publicUser(result.user),
      });
    } catch (err) {
      console.error('[auth/register]', err);
      return res.status(500).json({ ok: false, error: 'Could not complete registration.' });
    }
  }

  router.post('/register', handleRegister);
  // Backward-compatible alias (old clients called /register/start for OTP flow)
  router.post('/register/start', handleRegister);

  router.post('/login', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!EMAIL_RE.test(email) || !password) {
        return res.status(400).json({ ok: false, error: 'Email and password are required.' });
      }

      const settings = await getSettings();
      if (settings.maintenance) {
        return res.status(503).json({ ok: false, error: 'Platform is in maintenance mode.' });
      }

      const user = await findUserByEmail(email);
      if (!user || !user.password || !verifyPassword(password, user.password)) {
        return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
      }
      if (user.status === 'banned') {
        return res.status(403).json({ ok: false, error: 'This account has been banned.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ ok: false, error: 'This account is suspended.' });
      }

      const geo = await resolveClientGeo(req);
      await touchUserActivity(user.id, { ip: geo.ip || clientIp(req) });
      // Refresh country when we can resolve a real one and the account still lacks one.
      if (geo.country && geo.country !== 'Unknown' && geo.country !== 'Local network') {
        if (!user.country || user.country === 'Unknown' || user.country === 'Local network') {
          try {
            await updateUserAdmin(user.id, { country: geo.country });
          } catch {
            /* non-fatal */
          }
        }
      }

      const token = await createSession(user.id);
      return res.json({ ok: true, token, user: publicUser(user) });
    } catch (err) {
      console.error('[auth/login]', err);
      return res.status(500).json({ ok: false, error: 'Login failed.' });
    }
  });

  router.get('/me', async (req, res) => {
    const user = await getSessionUser(bearer(req));
    if (!user) return res.status(401).json({ ok: false, error: 'Not signed in.' });
    if (user.status === 'banned' || user.status === 'suspended') {
      return res.status(403).json({ ok: false, error: 'Account restricted.', user: publicUser(user) });
    }
    await touchUserActivity(user.id, { ip: clientIp(req) });
    return res.json({ ok: true, user: publicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    await destroySession(bearer(req));
    return res.json({ ok: true });
  });

  return router;
}

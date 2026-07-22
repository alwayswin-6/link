import { Router } from 'express';
import {
  confirmPendingSignup,
  createPendingSignup,
  createSession,
  destroySession,
  findUserByEmail,
  findUserByUsername,
  getPending,
  getSessionUser,
  getSettings,
  publicUser,
  resendPendingOtp,
  setPendingEmailStatus,
  touchUserActivity,
  verifyPassword,
} from './store.mjs';
import { sendOtpEmail } from './mail.mjs';
import { registerOAuthRoutes } from './oauth.mjs';

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

function detectCountry(req, bodyCountry) {
  if (bodyCountry && String(bodyCountry).trim()) return String(bodyCountry).trim().slice(0, 64);
  const header =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    '';
  if (header && String(header).length <= 3 && String(header).toUpperCase() !== 'XX') {
    return String(header).toUpperCase();
  }
  const lang = String(req.headers['accept-language'] || '');
  const m = /^([a-z]{2})(?:-([A-Z]{2}))?/i.exec(lang);
  if (m?.[2]) return m[2].toUpperCase();
  return '';
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

function inboxHint(email) {
  if (/@(gmail|googlemail)\.com$/i.test(email)) {
    return { provider: 'gmail', url: 'https://mail.google.com/' };
  }
  if (/@(outlook|hotmail|live|msn)\.com$/i.test(email)) {
    return { provider: 'outlook', url: 'https://outlook.live.com/mail/' };
  }
  return { provider: 'email', url: null };
}

async function deliverOtp(mailer, pending) {
  if (!mailer) {
    const msg = 'Email delivery is not configured (SMTP_USER / SMTP_PASS missing on the server).';
    console.error('[mail]', msg);
    await setPendingEmailStatus(pending.id, 'failed', msg);
    return false;
  }
  try {
    await sendOtpEmail(mailer, {
      to: pending.email,
      username: pending.username,
      code: pending.code,
    });
    await setPendingEmailStatus(pending.id, 'sent');
    console.log(`[mail] OTP delivered to ${pending.email}`);
    return true;
  } catch (mailErr) {
    const msg = mailErr?.message || String(mailErr);
    console.error('[mail] OTP send failed:', msg);
    await setPendingEmailStatus(pending.id, 'failed', msg);
    return false;
  }
}

export function createAuthRouter(mailer) {
  const router = Router();
  registerOAuthRoutes(router);

  /** Step 1: name + email + password → create pending, send OTP, then client shows verify page */
  router.post('/register/start', async (req, res) => {
    try {
      if (!mailer) {
        return res.status(503).json({
          ok: false,
          error:
            'Registration email is not configured. On Render, set SMTP_USER and SMTP_PASS in the Environment tab, then redeploy.',
        });
      }
      const settings = await getSettings();
      if (settings.registration === false) {
        return res.status(403).json({ ok: false, error: 'Registration is currently closed.' });
      }
      if (settings.maintenance) {
        return res.status(503).json({ ok: false, error: 'Platform is in maintenance mode.' });
      }

      const { email, username, password, name, country } = req.body ?? {};
      const displayName = String(name || username || '').trim();
      const error = validateRegister({ email, username: displayName, password });
      if (error) return res.status(400).json({ ok: false, error });

      if (await findUserByEmail(email)) {
        return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
      }
      const uname = displayName.replace(/\s+/g, '_');
      if (await findUserByUsername(uname)) {
        return res.status(409).json({ ok: false, error: 'That name is already taken.' });
      }

      const hint = inboxHint(email);
      const pending = await createPendingSignup({
        email,
        username: uname,
        password,
        provider: hint.provider,
        country: detectCountry(req, country),
      });

      // Respond immediately so the UI can open the verification page,
      // then deliver the OTP in the background (Gmail SMTP can be slow).
      res.status(200).json({
        ok: true,
        pendingId: pending.id,
        email: pending.email,
        inbox: hint,
        message: `Sending a 6-digit code to ${pending.email}…`,
      });

      void deliverOtp(mailer, pending);
      return;
    } catch (err) {
      console.error('[auth/register/start]', err);
      return res.status(500).json({ ok: false, error: 'Could not start registration.' });
    }
  });

  router.get('/register/status/:pendingId', async (req, res) => {
    const row = await getPending(req.params.pendingId);
    if (!row) return res.status(404).json({ ok: false, error: 'Verification expired.' });
    return res.json({
      ok: true,
      email: row.email,
      emailStatus: row.emailStatus || 'unknown',
      emailError: row.emailError,
      inbox: inboxHint(row.email),
    });
  });

  router.post('/register/confirm', async (req, res) => {
    try {
      const pendingId = String(req.body?.pendingId ?? '');
      const code = String(req.body?.code ?? '').trim();
      if (!pendingId || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ ok: false, error: 'Enter the 6-digit verification code.' });
      }

      const result = await confirmPendingSignup(pendingId, code);
      if (!result.ok) return res.status(400).json(result);

      await touchUserActivity(result.user.id, { ip: clientIp(req) });
      const token = await createSession(result.user.id);
      return res.status(201).json({
        ok: true,
        message: 'Registration complete.',
        token,
        user: publicUser(result.user),
      });
    } catch (err) {
      console.error('[auth/register/confirm]', err);
      return res.status(500).json({ ok: false, error: 'Could not complete registration.' });
    }
  });

  router.post('/register/resend', async (req, res) => {
    try {
      const pendingId = String(req.body?.pendingId ?? '');
      const row = await getPending(pendingId);
      if (!row) {
        return res.status(400).json({ ok: false, error: 'Verification expired. Start sign-up again.' });
      }
      const next = await resendPendingOtp(pendingId);
      if (!next) {
        return res.status(400).json({ ok: false, error: 'Verification expired. Start sign-up again.' });
      }
      const sent = await deliverOtp(mailer, next);
      if (!sent) {
        return res.status(502).json({ ok: false, error: 'Could not resend the code. Try again shortly.' });
      }
      return res.json({ ok: true, message: 'A new verification code was sent.' });
    } catch (err) {
      console.error('[auth/register/resend]', err);
      return res.status(500).json({ ok: false, error: 'Could not resend the code.' });
    }
  });

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
      if (!user.verified) {
        return res.status(403).json({
          ok: false,
          error: 'This account is not verified. Sign up again to receive a new code.',
        });
      }
      if (user.status === 'banned') {
        return res.status(403).json({ ok: false, error: 'This account has been banned.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ ok: false, error: 'This account is suspended.' });
      }

      await touchUserActivity(user.id, { ip: clientIp(req) });
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

import { randomBytes, createHash } from 'node:crypto';
import { createSession, upsertOAuthUser, persistUserAvatar, setUserAvatarUrl } from './store.mjs';
import { resolveClientGeo } from './geo.mjs';

const oauthStates = new Map(); // state -> { provider, verifier, expiresAt }

function appUrl() {
  return (
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://127.0.0.1:5173'
  ).replace(/\/$/, '');
}

function apiUrl() {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://127.0.0.1:5173'
  ).replace(/\/$/, '');
}

function pruneStates() {
  const now = Date.now();
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k);
  }
}

function makePkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Download a remote image and persist it under /api/avatars/:userId. Falls back to remote URL. */
async function attachAvatar(userId, { remoteUrl = '', buffer = null, mime = 'image/jpeg' } = {}) {
  try {
    if (buffer?.length) {
      const local = persistUserAvatar(userId, buffer, mime);
      if (local) return setUserAvatarUrl(userId, local);
    }
    if (remoteUrl) {
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get('content-type') || mime;
        if (bytes.length) {
          const local = persistUserAvatar(userId, bytes, type);
          if (local) return setUserAvatarUrl(userId, local);
        }
      }
      return setUserAvatarUrl(userId, remoteUrl);
    }
  } catch (err) {
    console.warn('[oauth] avatar attach failed', err?.message || err);
    if (remoteUrl) {
      try {
        return await setUserAvatarUrl(userId, remoteUrl);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

async function fetchMicrosoftPhoto(accessToken) {
  const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!photoRes.ok) return null;
  const buffer = Buffer.from(await photoRes.arrayBuffer());
  if (!buffer.length) return null;
  const mime = photoRes.headers.get('content-type') || 'image/jpeg';
  return { buffer, mime };
}

export function registerOAuthRoutes(router) {
  router.get('/oauth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Real redirect into Google account registration / sign-in when OAuth app is not configured yet.
      return res.redirect('https://accounts.google.com/signup');
    }
    pruneStates();
    const { verifier, challenge } = makePkce();
    const state = randomBytes(16).toString('hex');
    oauthStates.set(state, { provider: 'google', verifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    const redirectUri = `${apiUrl()}/api/auth/oauth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return res.redirect(url.toString());
  });

  router.get('/oauth/google/callback', async (req, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect(`${appUrl()}/?authError=google_not_configured`);
      }
      const { code, state } = req.query;
      const saved = oauthStates.get(String(state || ''));
      oauthStates.delete(String(state || ''));
      if (!code || !saved) return res.redirect(`${appUrl()}/?authError=google_state`);

      const redirectUri = `${apiUrl()}/api/auth/oauth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: saved.verifier,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error('[oauth/google] token error', tokens);
        return res.redirect(`${appUrl()}/?authError=google_token`);
      }

      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      if (!profile.email) return res.redirect(`${appUrl()}/?authError=google_email`);

      const geo = await resolveClientGeo(req);
      const user = await upsertOAuthUser({
        email: profile.email,
        username: profile.name || profile.given_name || profile.email.split('@')[0],
        provider: 'google',
        providerId: profile.sub,
        country: geo.country,
        ip: geo.ip,
        avatarUrl: profile.picture || '',
      });
      if (profile.picture) {
        await attachAvatar(user.id, { remoteUrl: profile.picture });
      }
      const session = await createSession(user.id);
      return res.redirect(`${appUrl()}/?authToken=${session}`);
    } catch (err) {
      console.error('[oauth/google]', err);
      return res.redirect(`${appUrl()}/?authError=google_failed`);
    }
  });

  router.get('/oauth/outlook', (req, res) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return res.redirect('https://signup.live.com/');
    }
    pruneStates();
    const { verifier, challenge } = makePkce();
    const state = randomBytes(16).toString('hex');
    oauthStates.set(state, { provider: 'microsoft', verifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    const redirectUri = `${apiUrl()}/api/auth/oauth/outlook/callback`;
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', 'openid email profile User.Read');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return res.redirect(url.toString());
  });

  router.get('/oauth/outlook/callback', async (req, res) => {
    try {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect(`${appUrl()}/?authError=outlook_not_configured`);
      }
      const { code, state } = req.query;
      const saved = oauthStates.get(String(state || ''));
      oauthStates.delete(String(state || ''));
      if (!code || !saved) return res.redirect(`${appUrl()}/?authError=outlook_state`);

      const redirectUri = `${apiUrl()}/api/auth/oauth/outlook/callback`;
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: String(code),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: saved.verifier,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error('[oauth/outlook] token error', tokens);
        return res.redirect(`${appUrl()}/?authError=outlook_token`);
      }

      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      const email = profile.mail || profile.userPrincipalName;
      if (!email) return res.redirect(`${appUrl()}/?authError=outlook_email`);

      const geo = await resolveClientGeo(req);
      const user = await upsertOAuthUser({
        email,
        username: profile.displayName || email.split('@')[0],
        provider: 'microsoft',
        providerId: profile.id,
        country: geo.country,
        ip: geo.ip,
      });
      const photo = await fetchMicrosoftPhoto(tokens.access_token);
      if (photo) {
        await attachAvatar(user.id, { buffer: photo.buffer, mime: photo.mime });
      }
      const session = await createSession(user.id);
      return res.redirect(`${appUrl()}/?authToken=${session}`);
    } catch (err) {
      console.error('[oauth/outlook]', err);
      return res.redirect(`${appUrl()}/?authError=outlook_failed`);
    }
  });
}

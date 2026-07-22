import nodemailer from 'nodemailer';
import { hasEnv, onRender } from './load-env.mjs';

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    const where = onRender
      ? 'Set it in Render Dashboard → Environment (not a .env file).'
      : 'Set it in your local .env file.';
    throw new Error(`Missing required env: ${name}. ${where}`);
  }
  return String(value).trim();
}

/** True when SMTP credentials are present in the process environment. */
export function isSmtpConfigured() {
  return hasEnv('SMTP_USER') && hasEnv('SMTP_PASS');
}

export function createMailer() {
  if (!isSmtpConfigured()) {
    throw new Error(
      onRender
        ? 'SMTP_USER / SMTP_PASS are not set. Add them in the Render Environment tab, then redeploy.'
        : 'SMTP_USER / SMTP_PASS are not set. Copy .env.example to .env and fill them in.',
    );
  }

  const user = required('SMTP_USER');
  const pass = required('SMTP_PASS').replace(/\s+/g, '');
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);

  // Gmail is more reliable on 465/SSL than 587 on some networks.
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: { minVersion: 'TLSv1.2', servername: host },
  });

  // Warm the connection in the background so the first signup is faster.
  transport.verify().then(
    () => console.log('[smtp] ready'),
    (err) => console.warn('[smtp] warmup failed:', err?.message || err),
  );

  return transport;
}

export function fromAddress() {
  const name = process.env.SMTP_FROM_NAME || process.env.SMTP_NAME || 'link';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

export async function sendOtpEmail(mailer, { to, username, code }) {
  if (!mailer) {
    throw new Error('Mailer is not configured.');
  }
  return mailer.sendMail({
    from: fromAddress(),
    to,
    subject: `${code} is your LINK verification code`,
    text: [
      `Hi ${username},`,
      '',
      'Your LINK sign-up verification code is:',
      '',
      `  ${code}`,
      '',
      'Enter this 6-digit code in LINK to finish registration.',
      'The code expires in 10 minutes.',
      '',
      'If you did not request this, ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#0b0f1a;color:#e8f0ff;padding:32px">
        <div style="max-width:480px;margin:0 auto;background:#121826;border:1px solid #3a2a6a;border-radius:12px;padding:28px">
          <h1 style="margin:0 0 8px;font-size:22px;letter-spacing:0.08em">LINK</h1>
          <p style="margin:0 0 18px;color:#9aa6c2">Email verification</p>
          <p style="margin:0 0 12px">Hi <strong>${escapeHtml(username)}</strong>,</p>
          <p style="margin:0 0 18px">Enter this 6-digit code in LINK to complete sign-up:</p>
          <div style="font-size:32px;letter-spacing:0.35em;font-weight:700;text-align:center;padding:16px 0;color:#dccfff">${escapeHtml(code)}</div>
          <p style="margin:18px 0 0;font-size:12px;color:#7a8aaa">Expires in 10 minutes. Do not share this code.</p>
        </div>
      </div>
    `,
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

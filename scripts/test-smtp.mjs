import '../server/load-env.mjs';
import { createMailer, sendOtpEmail, isSmtpConfigured } from '../server/mail.mjs';

const to = process.argv[2] || process.env.SMTP_USER;
const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

if (!to || !isSmtpConfigured()) {
  console.error('Usage: node scripts/test-smtp.mjs you@example.com');
  console.error('Requires SMTP_USER / SMTP_PASS in .env (local) or process environment (Render).');
  process.exit(1);
}

const mailer = createMailer();
console.log('[test-smtp] verifying transporter…');
await mailer.verify();
console.log('[test-smtp] transporter OK, sending to', to);
const info = await sendOtpEmail(mailer, {
  to,
  username: 'SMTP-Test',
  code,
});
console.log('[test-smtp] sent', { messageId: info.messageId, response: info.response, code });

import 'dotenv/config';
import { createMailer, sendOtpEmail } from '../server/mail.mjs';

const to = process.argv[2] || process.env.SMTP_USER;
const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

const mailer = createMailer();
console.log('[test-smtp] verifying transporter…');
await mailer.verify();
console.log('[test-smtp] transporter OK, sending to', to);
const info = await sendOtpEmail(mailer, {
  to,
  username: 'SMTP-Test',
  code,
  provider: 'gmail',
});
console.log('[test-smtp] sent', { messageId: info.messageId, response: info.response, code });

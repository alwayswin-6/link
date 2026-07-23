/**
 * Posts a file into the Super Admin /secret download slot (local JSON store or Postgres).
 *
 * Usage:
 *   node scripts/seed-secret.mjs [path-to-file]
 *   npm run seed:secret
 *   npm run seed:secret -- "F:\work\LINK\game app\GameApp-secret.zip"
 *
 * Default file: ../game app/GameApp-secret.zip (sibling of this repo)
 */
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initStore, saveSecretUpload, getSecretUploadMeta } from '../server/store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const defaultZip = resolve(root, '..', 'game app', 'GameApp-secret.zip');
const filePath = resolve(process.argv[2] || process.env.SECRET_FILE || defaultZip);

if (!existsSync(filePath)) {
  console.error(`[seed-secret] File not found: ${filePath}`);
  console.error('[seed-secret] Build the ZIP first, or pass a path: npm run seed:secret -- <file>');
  process.exit(1);
}

const data = readFileSync(filePath);
const filename = basename(filePath);
const mime =
  filename.toLowerCase().endsWith('.zip')
    ? 'application/zip'
    : filename.toLowerCase().endsWith('.exe')
      ? 'application/vnd.microsoft.portable-executable'
      : 'application/octet-stream';

await initStore();
const saved = await saveSecretUpload({
  filename,
  mime,
  size: data.length,
  data,
  uploadedBy: 'seed-secret',
});

const meta = await getSecretUploadMeta();
console.log('[seed-secret] Secret slot updated.');
console.log(`[seed-secret] File: ${saved.filename} (${saved.size} bytes)`);
console.log(`[seed-secret] MIME: ${saved.mime}`);
console.log('[seed-secret] Public URL: /secret');
if (meta) {
  console.log(`[seed-secret] Created: ${meta.createdAt}`);
}
console.log('[seed-secret] Local test: http://127.0.0.1:3001/secret');
console.log('[seed-secret] Via Vite:  http://127.0.0.1:5173/secret');

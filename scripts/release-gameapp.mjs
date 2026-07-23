/**
 * Build the Windows GameApp payload ZIP and seed it into lINK's /secret slot.
 *
 * Usage (from F:\work\LINK\lINK):
 *   npm run gameapp:release
 *
 * Steps:
 *   1. Runs ..\game app\build.bat (payload ZIP + downloader EXE + seed:secret)
 *   2. Optionally publishes over HTTP when the API is up (publish:secret)
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const linkRoot = join(__dirname, '..');
const gameAppRoot = resolve(linkRoot, '..', 'game app');
const buildBat = join(gameAppRoot, 'build.bat');
const secretZip = join(gameAppRoot, 'GameApp-secret.zip');

if (!existsSync(buildBat)) {
  console.error('[gameapp:release] Missing build.bat at', buildBat);
  process.exit(1);
}

console.log('[gameapp:release] Building + seeding via', buildBat);
const build = spawnSync(buildBat, [], {
  cwd: gameAppRoot,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
if (build.status !== 0) {
  process.exit(build.status || 1);
}

if (!existsSync(secretZip)) {
  console.error('[gameapp:release] Expected ZIP missing:', secretZip);
  process.exit(1);
}

// Best-effort live publish so a running API process also has the new bytes.
console.log('[gameapp:release] Publishing to running API (if available)...');
const publish = spawnSync(
  process.execPath,
  [join(linkRoot, 'scripts', 'publish-secret.mjs'), '--file', secretZip, '--url', 'http://127.0.0.1:3001'],
  { cwd: linkRoot, stdio: 'inherit', env: process.env },
);
if (publish.status !== 0) {
  console.warn('[gameapp:release] publish:secret skipped/failed — seed:secret (file store) already ran in build.bat.');
}

console.log('[gameapp:release] Done.');
console.log('[gameapp:release] Downloader: ', join(gameAppRoot, 'GameApp.exe'));
console.log('[gameapp:release] Secret ZIP:', secretZip);
console.log('[gameapp:release] URL: http://127.0.0.1:5173/secret');

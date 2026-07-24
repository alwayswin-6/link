/**
 * Generates src/builtin-media.ts with ~100 HD reaction GIFs.
 * Run: node scripts/gen-builtin-media.mjs
 */
import https from 'node:https';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'builtin-media.ts');

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

const COOL =
  /fire|laser|deal|party|cool|fast|shiny|matrix|cyber|gamer|rage|dark|ultra|hyper|blaze|rocket|ninja|sith|jedi|vampire|zombie|disco|glitch|neon|pulse|thunder|electric|metal|devil|angel|king|queen|boss|legend|epic|power|blast|coffee|beer|flex|think|cry|sad|love|heart|congrats|wave|thumb|reverse|goth|cop|spy|hacker|github|meme|cat|dog|dragon|portal|money|evil|angry|spin|60fps|darkmode|moonwalk|popcorn|mustache|pirate|viking|sherlock|biker|laptop|invisible|birthday|christmas|science|revolution|gentleman|sassy|confused|shuffle|conga|aussie|hdr|open-source|middle|twins|stable|donut|sushi|pumpkin|ceiling|mardi|hard.?hat|bunny|marshmallow|white.?walker|french|bootleg|ping.?pong|football|flower|spinning|tie.?dye|horizontal|tennis|boba|backwards|rip|short|original|groucho|chico|harpo|red.?hat|red.?envelope|norwegian|brazil|sint|blunt|wendy|dad|slow|bored|sleep|happy.?hour|flying.?money|calvinist|not.?found|inverse|transparent|player|fan|deal.?with.?it|ultra.?fast|github|sith|jedi|disco|evil|angry|party|fast|shiny|goth|spy|portal|money|moonwalk|60fps|dark.?mode|biker|laptop|viking|sherlock|spinning|tie.?dye|boba|rip|hdr|open.?source|conga|shuffle|sassy|confused|gentleman|coffee|thumb|popcorn|mustache|christmas|birthday|pirate|angel|pumpkin|sushi|science|revolution|invisible|marshmallow|white.?walker|github|bootleg|ping.?pong|football|flower|red.?envelope|norwegian|brazil|hard.?hat|ceiling|mardi|twins|stable|donut|wendy|dad|slow|bored|sleep|beer|blunt|sint|calvinist|original|groucho|chico|harpo|tennis|horizontal|backwards|short|inverse|transpar|aussie|middle|reverse|cop|deal/i;

const all = await getJson('https://cultofthepartyparrot.com/parrots.json');
const hd = all.filter((p) => p.hd).map((p) => ({ name: p.name, path: p.hd }));
const preferred = hd.filter((p) => COOL.test(p.name) || COOL.test(p.path));
const rest = hd.filter((p) => !preferred.includes(p));
const pick = [...preferred, ...rest].slice(0, 100);

const stickerBlock = `/** Built-in chat emotes — available immediately, no admin upload required. */

export type BuiltinMedia = {
  id: string;
  kind: 'sticker' | 'gif';
  name: string;
  previewUrl: string;
  assetUrl: string;
  createdAt: string;
};

/** Twemoji PNG from codepoints (e.g. "1f525"). */
function twemoji(code: string): string {
  return \`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/\${code}.png\`;
}

/** Large reaction-style stickers (Twemoji). */
export const BUILTIN_STICKERS: BuiltinMedia[] = [
  ['fire', 'Fire', '1f525'],
  ['100', '100', '1f4af'],
  ['clap', 'Clap', '1f44f'],
  ['thumbs', 'Thumbs up', '1f44d'],
  ['heart', 'Heart', '2764'],
  ['star', 'Star', '2b50'],
  ['rocket', 'Rocket', '1f680'],
  ['trophy', 'Trophy', '1f3c6'],
  ['skull', 'Skull', '1f480'],
  ['ghost', 'Ghost', '1f47b'],
  ['robot', 'Robot', '1f916'],
  ['alien', 'Alien', '1f47d'],
  ['game', 'Controller', '1f3ae'],
  ['joystick', 'Joystick', '1f579'],
  ['target', 'Bullseye', '1f3af'],
  ['dice', 'Dice', '1f3b2'],
  ['party', 'Party', '1f389'],
  ['confetti', 'Confetti', '1f38a'],
  ['flex', 'Flex', '1f4aa'],
  ['eyes', 'Eyes', '1f440'],
  ['think', 'Thinking', '1f914'],
  ['cool', 'Cool', '1f60e'],
  ['cry', 'Cry', '1f622'],
  ['rage', 'Rage', '1f621'],
  ['zzz', 'Sleep', '1f4a4'],
  ['boom', 'Boom', '1f4a5'],
  ['sparkles', 'Sparkles', '2728'],
  ['rainbow', 'Rainbow', '1f308'],
  ['pizza', 'Pizza', '1f355'],
  ['coffee', 'Coffee', '2615'],
].map(([id, name, code]) => {
  const url = twemoji(code);
  return {
    id: \`builtin-sticker-\${id}\`,
    kind: 'sticker' as const,
    name,
    previewUrl: url,
    assetUrl: url,
    createdAt: '2020-01-01T00:00:00.000Z',
  };
});

const CREATED = '2020-01-01T00:00:00.000Z';

/** ${pick.length} HD reaction GIFs — Cult of the Party Parrot catalog (no admin upload). */
export const BUILTIN_GIFS: BuiltinMedia[] = [
`;

const PARROT_BASE = 'https://cultofthepartyparrot.com/parrots';

const rows = pick.map((p, i) => {
  const id = p.path
    .replace(/^hd\//, '')
    .replace(/\.gif$/i, '')
    .replace(/[^a-z0-9_-]/gi, '')
    .toLowerCase() || String(i);
  const label = p.name.replace(/\s+Parrot$/i, '').trim() || p.name;
  const url = `${PARROT_BASE}/${p.path}`;
  return `  {
    id: 'builtin-gif-${id}',
    kind: 'gif',
    name: ${JSON.stringify(label)},
    previewUrl: '${url}',
    assetUrl: '${url}',
    createdAt: CREATED,
  }`;
});

const out = stickerBlock + rows.join(',\n') + ',\n];\n';
writeFileSync(OUT, out);
console.log(`Wrote ${pick.length} GIFs → ${OUT}`);

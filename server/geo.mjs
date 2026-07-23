/**
 * Resolve country from client IP for admin visibility.
 * Prefers CDN country headers, then a free HTTPS geo lookup.
 */

const cache = new Map(); // ip -> { country, at }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const ISO_NAMES = {
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  BR: 'Brazil',
  MX: 'Mexico',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  IN: 'India',
  AU: 'Australia',
  RU: 'Russia',
  TR: 'Turkey',
  PL: 'Poland',
  NL: 'Netherlands',
  SE: 'Sweden',
  PH: 'Philippines',
  ID: 'Indonesia',
  VN: 'Vietnam',
  TH: 'Thailand',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  ZA: 'South Africa',
  AR: 'Argentina',
  UA: 'Ukraine',
  PT: 'Portugal',
  CZ: 'Czechia',
  RO: 'Romania',
  HU: 'Hungary',
  AT: 'Austria',
  CH: 'Switzerland',
  BE: 'Belgium',
  IE: 'Ireland',
  NZ: 'New Zealand',
  MY: 'Malaysia',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  IL: 'Israel',
  EG: 'Egypt',
  NG: 'Nigeria',
  KE: 'Kenya',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  PK: 'Pakistan',
  BD: 'Bangladesh',
};

export function normalizeIp(raw) {
  let ip = String(raw || '').trim();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  // Strip IPv6 zone / brackets
  ip = ip.replace(/^\[|\]$/g, '');
  return ip;
}

export function isPrivateIp(ip) {
  const v = normalizeIp(ip);
  if (!v) return true;
  if (v === '127.0.0.1' || v === '0.0.0.0') return true;
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  return false;
}

function countryFromCode(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (!c || c === 'XX' || c === 'T1' || c === 'A1' || c === 'A2') return '';
  return ISO_NAMES[c] || c;
}

function countryFromHeaders(req) {
  const header =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    req.headers['cloudfront-viewer-country'] ||
    '';
  return countryFromCode(header);
}

async function lookupIpCountry(ip) {
  const key = normalizeIp(ip);
  if (!key || isPrivateIp(key)) return 'Local network';

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.country;

  const controllers = [
    async () => {
      const res = await fetch(`https://ipapi.co/${encodeURIComponent(key)}/json/`, {
        headers: { Accept: 'application/json', 'User-Agent': 'link-platform/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return '';
      const data = await res.json();
      if (data?.error) return '';
      return String(data.country_name || countryFromCode(data.country_code) || '').trim();
    },
    async () => {
      // Free HTTP endpoint (fallback). Works from most cloud hosts.
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(key)}?fields=status,country,countryCode`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return '';
      const data = await res.json();
      if (data?.status !== 'success') return '';
      return String(data.country || countryFromCode(data.countryCode) || '').trim();
    },
  ];

  for (const fn of controllers) {
    try {
      const country = await fn();
      if (country) {
        cache.set(key, { country, at: Date.now() });
        return country;
      }
    } catch {
      /* try next provider */
    }
  }

  return 'Unknown';
}

/**
 * Resolve a display country for registration / admin.
 * @returns {Promise<{ ip: string, country: string }>}
 */
export async function resolveClientGeo(req) {
  const xf = req.headers['x-forwarded-for'];
  const forwarded = typeof xf === 'string' ? xf.split(',')[0].trim() : '';
  const ip = normalizeIp(forwarded || req.socket?.remoteAddress || '');

  const fromHeader = countryFromHeaders(req);
  if (fromHeader) return { ip, country: fromHeader };

  const country = await lookupIpCountry(ip);
  return { ip, country: country || 'Unknown' };
}

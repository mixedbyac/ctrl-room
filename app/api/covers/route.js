import { getConfig, setConfig, userFrom, isEngineer, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Cover art for the sign-in page background, pulled from an Apple Music playlist the engineer picks.
// Cached for a day so the page stays fast.
// Anthony "AC" Carballo – The Engineer's playlist; used until a different one is set in Security.
const DEFAULT_PLAYLIST = 'https://music.apple.com/us/playlist/anthony-ac-carballo-the-engineers/pl.0c730da3fdbe4c029a36649986cfc842';
const ART = /https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/[^"'\s\\]+?\/\{w\}x\{h\}[^"'\s\\]*/g;

function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || out.length >= 120) return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out, seen)); return; }
  const art = node.artwork?.dictionary?.url || node.artwork?.url;
  if (typeof art === 'string' && art.includes('{w}')) {
    const img = art.replace('{w}x{h}', '300x300').replace('{c}', 'bb').replace('{f}', 'jpg');
    const link = node.contentDescriptor?.url || node.url || node.album?.url || null;
    if (!seen.has(img)) { seen.add(img); out.push({ img, link: typeof link === 'string' && link.startsWith('https://music.apple.com') ? link : null, title: node.title || node.name || '', artist: node.artistName || node.subtitle || '' }); }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, seen);
}

async function fromPlaylist(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en' } });
  if (!res.ok) throw new Error(`Apple Music said ${res.status}`);
  const html = await res.text();
  const out = [], seen = new Set();
  const m = html.match(/<script[^>]+id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  if (m) { try { walk(JSON.parse(m[1]), out, seen); } catch {} }
  if (out.length < 6) for (const a of html.match(ART) || []) {
    const img = a.replace('{w}x{h}', '300x300').replace('{c}', 'bb').replace('{f}', 'jpg');
    if (!seen.has(img)) { seen.add(img); out.push({ img, link: null, title: '', artist: '' }); }
  }
  // the playlist's own cover tends to be first; drop it if there are plenty of tracks
  return out.length > 8 ? out.slice(1) : out;
}

export async function GET(req) {
  const slow = limit(req, 'covers', 60, 600_000); if (slow) return slow;
  const url = (await getConfig('login_playlist')) || DEFAULT_PLAYLIST;
  const cached = JSON.parse((await getConfig('login_covers')) || 'null');
  if (cached && cached.url === url && Date.now() - cached.at < 24 * 3600 * 1000) return json({ covers: cached.covers });
  try {
    const covers = await fromPlaylist(url);
    if (covers.length) await setConfig('login_covers', JSON.stringify({ url, at: Date.now(), covers }));
    return json({ covers });
  } catch {
    return json({ covers: cached?.covers || [] });
  }
}

// Engineer: set the playlist. body: { url }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user.email))) return fail('Only the engineer can change this.', 403);
  const b = await req.json().catch(() => ({}));
  const url = String(b.url || '').trim();
  if (!url) { await setConfig('login_playlist', null); await setConfig('login_covers', null); return json({ covers: 0, default: true }); }
  if (!/^https:\/\/music\.apple\.com\/[a-z]{2}\/playlist\//i.test(url)) return fail('Paste an Apple Music playlist link (music.apple.com/…/playlist/…).');
  try {
    const covers = await fromPlaylist(url);
    if (!covers.length) return fail('Couldn’t find any cover art on that playlist. Is it public?');
    await setConfig('login_playlist', url);
    await setConfig('login_covers', JSON.stringify({ url, at: Date.now(), covers }));
    return json({ covers: covers.length });
  } catch (e) { return fail(e.message, 502); }
}

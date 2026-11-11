import { shareInfo, requestInfo } from '@/lib/sharemeta';
import { admin } from '@/lib/server';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';
const hue = (seed) => Math.abs(Number(seed) || 7) % 360;

async function grab(url, ms, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/^image\//.test(type)) throw new Error('no image');
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 2000) throw new Error('too small');
  return { buf, type };
}

// The picture link previews show (iMessage, Instagram, WhatsApp, Slack…): the cover art as a 1200px JPEG, quickly.
// Lives outside /api so Vercel's CDN can cache it (iMessage gives up on slow images and shows a tiny icon instead).
export async function GET(req, { params }) {
  const key = String(params.key || '').replace(/\.(jpe?g|png)$/i, '');
  // brand cards: the app itself, the Portal, and a project's file-request link
  if (key === 'brand' || key === 'portal' || key.startsWith('req_')) return card(key, req);
  const info = await shareInfo(key, { light: !0 }).catch(() => null);
  if (info?.coverPath && info.cover) {
    const tries = [];
    // Vercel shrinks it to 1200px (JPEG, since we ask for one)
    tries.push(grab(`${SITE_URL}/_next/image?url=${encodeURIComponent(info.cover)}&w=1200&q=80`, 7000, { Accept: 'image/jpeg' }));
    // Supabase image resizing, if the plan has it
    tries.push((async () => {
      const { data } = await admin().storage.from('mixes').createSignedUrl(info.coverPath, 3600, { transform: { width: 1200, height: 1200, resize: 'cover', quality: 80, format: 'origin' } });
      if (!data?.signedUrl) throw new Error('no transform');
      return grab(data.signedUrl, 7000, { Accept: 'image/jpeg' });
    })());
    let got = await Promise.any(tries).catch(() => null);
    if (!got) got = await grab(info.cover, 8000).catch(() => null); // the original, as a last resort
    if (got) return new Response(got.buf, { headers: { 'Content-Type': got.type, 'Content-Length': String(got.buf.byteLength), 'Cache-Control': CACHE } });
  }
  // no cover art: a square card in the project's colors
  const { ImageResponse } = await import('next/og');
  const h = hue(info?.seed);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 1200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 90, color: '#fff', fontFamily: 'sans-serif',
        background: `linear-gradient(135deg, ${hex(h, 70, 55)}, ${hex((h + 70) % 360, 65, 32)} 60%, ${hex((h + 150) % 360, 60, 14)})` }}>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, opacity: 0.85, marginBottom: 16 }}>{info?.artist || 'CTRL ROOM'}</div>
        <div style={{ display: 'flex', fontSize: (info?.title || '').length > 18 ? 96 : 130, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{info?.title || 'Listen'}</div>
      </div>
    ),
    { width: 1200, height: 1200, headers: { 'Cache-Control': CACHE } },
  );
}

// the preview renderer can't read hsl() inside a gradient: hand it plain hex colours
function hex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

// the app's font (Geist), fetched once per server instance as TTF (the preview renderer can't read woff2)
const fonts = {};
async function geist(weight) {
  if (!fonts[weight]) fonts[weight] = (async () => {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' }, signal: AbortSignal.timeout(4000) })).text();
    const url = /src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/.exec(css)?.[1];
    if (!url) throw new Error('no font');
    return (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer();
  })().catch((e) => { delete fonts[weight]; throw e; });
  return fonts[weight];
}

// 1200×630 cards: logo, a big line, and (for a request link) the project's cover
async function card(key, req) {
  const { ImageResponse } = await import('next/og');
  const origin = new URL(req.url).origin;
  const logo = `${origin}/logo.png`;
  let info = null;
  if (key.startsWith('req_')) info = await requestInfo(decodeURIComponent(key.slice(4))).catch(() => null);
  let cover = null;
  if (info?.cover) {
    const got = await grab(`${SITE_URL}/_next/image?url=${encodeURIComponent(info.cover)}&w=640&q=80`, 6000, { Accept: 'image/jpeg' }).catch(() => grab(info.cover, 6000).catch(() => null));
    if (got) cover = `data:${got.type};base64,${Buffer.from(got.buf).toString('base64')}`;
  }
  const h = hue(info?.seed);
  const kicker = key === 'brand' ? 'CTRL ROOM' : key === 'portal' ? 'SEND FILES HERE' : 'FILE REQUEST';
  const big = key === 'brand' ? 'Listen, leave notes, approve.' : key === 'portal' ? 'Send your files.' : `Send files for ${info?.title || 'your project'}`;
  const sub = key === 'brand' ? 'Mixes from your engineer, in one place.' : key === 'portal' ? 'Up to 5 GB. No account needed.' : `${info?.artist ? `${info.artist} · ` : ''}Up to 5 GB. No account needed.`;
  const fontList = (await Promise.all([[800, 'Geist'], [500, 'Geist']].map(async ([w, name]) => ({ name, weight: w, style: 'normal', data: await geist(w) })).map((p) => p.catch(() => null)))).filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', alignItems: 'center', padding: 80, gap: 64, background: '#0B0B0C', color: '#fff', fontFamily: fontList.length ? 'Geist' : 'sans-serif' }}>
        {key.startsWith('req_') && (
          <div style={{ width: 400, height: 400, borderRadius: 28, overflow: 'hidden', display: 'flex', flexShrink: 0,
            background: `linear-gradient(135deg, ${hex(h, 70, 55)}, ${hex((h + 70) % 360, 65, 32)} 60%, ${hex((h + 150) % 360, 60, 14)})` }}>
            {cover && <img src={cover} width={400} height={400} style={{ objectFit: 'cover' }} />}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src={logo} width={64} height={64} />
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, letterSpacing: 5, color: '#9a9aa2' }}>{kicker}</div>
          </div>
          <div style={{ display: 'flex', fontSize: big.length > 26 ? 64 : 80, fontWeight: 800, lineHeight: 0.98, letterSpacing: -2.5, textTransform: 'uppercase' }}>{big}</div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 500, color: '#9a9aa2' }}>{sub}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fontList, headers: { 'Cache-Control': key.startsWith('req_') ? 'public, max-age=3600, s-maxage=86400' : CACHE } },
  );
}

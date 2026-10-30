import { shareInfo } from '@/lib/sharemeta';
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
        background: `linear-gradient(135deg, hsl(${h},70%,55%), hsl(${(h + 70) % 360},65%,32%) 60%, hsl(${(h + 150) % 360},60%,14%))` }}>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, opacity: 0.85, marginBottom: 16 }}>{info?.artist || 'CTRL ROOM'}</div>
        <div style={{ display: 'flex', fontSize: (info?.title || '').length > 18 ? 96 : 130, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{info?.title || 'Listen'}</div>
      </div>
    ),
    { width: 1200, height: 1200, headers: { 'Cache-Control': CACHE } },
  );
}

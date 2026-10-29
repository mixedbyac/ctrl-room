import { ImageResponse } from 'next/og';
import { shareInfo } from '@/lib/sharemeta';
import { admin } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hue = (seed) => Math.abs(Number(seed) || 7) % 360;
const CACHE = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

// The picture a share link shows in iMessage, Instagram DMs, WhatsApp, Slack…
// With real cover art: the cover itself (fast and reliable, which iMessage needs). Otherwise a square card in the cover's colors.
export async function GET(req, { params }) {
  const info = await shareInfo(params.token).catch(() => null);
  if (info?.cover) {
    // a smaller copy when Supabase can resize images, otherwise the original
    let src = info.cover;
    try {
      const { data } = await admin().storage.from('mixes').createSignedUrl(info.coverPath, 3600, { transform: { width: 1200, height: 1200, resize: 'cover', quality: 82 } });
      if (data?.signedUrl) { const t = await fetch(data.signedUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null); if (t?.ok) src = data.signedUrl; }
    } catch {}
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(6000) });
      if (r.ok) return new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': CACHE } });
    } catch {}
  }
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

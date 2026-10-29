import { ImageResponse } from 'next/og';
import { shareInfo } from '@/lib/sharemeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hue = (seed) => Math.abs(Number(seed) || 7) % 360;

// The preview card a share link shows in iMessage, Instagram DMs, WhatsApp, Slack…
export async function GET(req, { params }) {
  const info = await shareInfo(params.token).catch(() => null);
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const h = hue(info?.seed);
  const art = info?.cover
    ? <img src={info.cover} width={470} height={470} style={{ borderRadius: 28, objectFit: 'cover', boxShadow: '0 40px 80px rgba(0,0,0,.6)' }} />
    : <div style={{ width: 470, height: 470, borderRadius: 28, display: 'flex', background: `linear-gradient(135deg, hsl(${h},70%,55%), hsl(${(h + 70) % 360},65%,35%) 60%, hsl(${(h + 150) % 360},60%,18%))`, boxShadow: '0 40px 80px rgba(0,0,0,.6)' }} />;
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', background: '#0f0f10', color: '#f4f4f5', fontFamily: 'sans-serif' }}>
        {info?.cover && <img src={info.cover} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.22 }} />}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(90deg, rgba(15,15,16,.35), rgba(15,15,16,.92) 55%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 56, padding: '80px 70px', width: '100%', position: 'relative' }}>
          {art}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: '#f5d547', fontWeight: 700, marginBottom: 18 }}>{info ? (info.kind === 'song' ? info.project : `${info.count} song${info.count === 1 ? '' : 's'}`) : 'CTRL ROOM'}</div>
            <div style={{ fontSize: (info?.title || '').length > 22 ? 64 : 82, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, marginBottom: 22, display: 'flex' }}>{info?.title || 'Listen in CTRL ROOM'}</div>
            {info && <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 600, color: '#e4e4e7' }}>
              {info.artistImage && <img src={info.artistImage} width={54} height={54} style={{ borderRadius: 27, objectFit: 'cover' }} />}
              {info.artist}
            </div>}
            {info?.credit && <div style={{ marginTop: 20, fontSize: 24, color: '#a1a1aa', display: 'flex' }}>{info.credit}</div>}
            <div style={{ marginTop: 'auto', paddingTop: 40, display: 'flex', alignItems: 'center', gap: 14, fontSize: 24, color: '#a1a1aa', fontWeight: 700, letterSpacing: 2 }}>
              <img src={`${site}/logo.png`} width={44} height={44} />CTRL ROOM
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  );
}

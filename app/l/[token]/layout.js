import { SITE_URL } from '@/lib/site';
import { shareInfo } from '@/lib/sharemeta';

export const dynamic = 'force-dynamic';

// Link previews for share links: the cover art with the song / project and artist name.
export async function generateMetadata({ params }) {
  const site = SITE_URL;
  let info = null;
  try { info = await shareInfo(params.token); } catch {}
  if (!info) return { title: 'CTRL ROOM', description: 'Listen in CTRL ROOM.', robots: { index: false } };
  const title = `${info.title} · ${info.artist}`;
  const description = [info.kind === 'song' ? info.project : `${info.count} song${info.count === 1 ? '' : 's'}`, info.credit, 'Listen in CTRL ROOM'].filter(Boolean).join(' · ');
  const image = `${site}/api/og/${encodeURIComponent(params.token)}`;
  return {
    title, description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'music.song', siteName: 'CTRL ROOM', url: `${site}/l/${params.token}`, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function ShareLayout({ children }) { return children; }

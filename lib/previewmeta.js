import { SITE_URL } from '@/lib/site';
import { shareInfo } from '@/lib/sharemeta';

/**
 * Link preview (iMessage, Instagram DMs, WhatsApp, Slack…) like a music card: big cover art, the song or project name,
 * and ctrl-room.app underneath. key = share token, or p_<projectId> / s_<songId> for app links.
 */
export async function previewMeta(key, path) {
  const site = SITE_URL;
  let info = null;
  try { info = await shareInfo(key); } catch {}
  if (!info) return { title: 'CTRL ROOM', robots: { index: false }, ...brandMeta() }; // still shows the CTRL ROOM card
  const title = info.title;
  const description = [info.artist, info.kind === 'song' ? (info.project !== info.title ? info.project : '') : `${info.count} song${info.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
  const image = { url: `${site}/og/${encodeURIComponent(key)}.jpg`, width: 1200, height: 1200, alt: title, type: 'image/jpeg' };
  return {
    title, description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'CTRL ROOM', url: `${site}${path}`, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
    other: { 'og:image:secure_url': image.url },
  };
}

/** The default CTRL ROOM card, for every page that has no preview of its own. */
export function brandMeta() {
  const image = { url: `${SITE_URL}/og/brand.jpg?v=3`, width: 1200, height: 630, alt: 'CTRL ROOM', type: 'image/jpeg' };
  const title = 'CTRL ROOM', description = 'Listen, leave notes, and approve your mixes.';
  return { openGraph: { title, description, type: 'website', siteName: 'CTRL ROOM', images: [image] }, twitter: { card: 'summary_large_image', title, description, images: [image.url] } };
}

import { limit } from '@/lib/ratelimit';
import { admin, json, fail, getConfig, setConfig, sendText } from '@/lib/server';
import { findLeaks } from '@/lib/leaks';

export const runtime = 'nodejs';

// Public: counts listens on share links so the engineer sees them in Activity.
export async function POST(req) {
  const slow = limit(req, 'share-play', 600, 600000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  if (!b?.t || !b?.songId) return fail('Missing details.');
  const db = admin();
  // the song must belong to this link
  const { data: s } = await db.from('songs').select('id, project_id, share_token, sharing').eq('id', b.songId).maybeSingle();
  if (!s || s.sharing === false) return fail('Not shared.', 403);
  let via = 'from a share link';
  if (s.share_token !== b.t) {
    const { data: p } = await db.from('projects').select('id').eq('id', s.project_id).eq('share_token', b.t).maybeSingle();
    if (!p) return fail('Not shared.', 403);
    via = 'from a project share link';
  }
  const row = { listened: Math.max(0, +b.listened || 0), duration: +b.duration || null, bins: typeof b.bins === 'string' ? b.bins.slice(0, 2000) : null, updated_at: new Date().toISOString() };
  if (b.playId) {
    await db.from('plays').update(row).eq('id', b.playId).is('listener_email', null);
    return json({ id: b.playId });
  }
  // roughly where the listen came from (city level, from Vercel), so leaks can be spotted
  const h = (k) => { try { return decodeURIComponent(req.headers.get(k) || ''); } catch { return ''; } };
  const place = [h('x-vercel-ip-city'), h('x-vercel-ip-country')].filter(Boolean).join(', ');
  const device = `${String(b.device || 'Unknown device').slice(0, 50)}${place ? ` — ${place.slice(0, 40)}` : ''}`;
  const { data } = await db.from('plays').insert({ ...row, song_id: s.id, version_id: b.versionId || null, listener_email: null, device, source: via }).select('id').single();
  checkLeaks(db, s).catch(() => {});
  return json({ id: data?.id || null });
}

// Text the engineer right away if this listen looks like a leak (once per song, kind and day).
async function checkLeaks(db, s) {
  if (!process.env.ENGINEER_PHONE) return;
  const { data: ids } = await db.from('songs').select('id').eq('project_id', s.project_id);
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: plays } = await db.from('plays').select('id, song_id, started_at, updated_at, device, source, listener_email, songs(title, project_id, projects(title))')
    .in('song_id', (ids || []).map((x) => x.id)).gte('started_at', since).limit(2000);
  const fresh = findLeaks(plays || []).filter((a) => a.songId === s.id && Date.now() - a.at < 15 * 60 * 1000);
  for (const a of fresh) {
    const key = `alerted:${a.key}`;
    if (await getConfig(key)) continue;
    await setConfig(key, new Date().toISOString());
    const site = process.env.NEXT_PUBLIC_SITE_URL || '';
    await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: unusual activity on ${a.title}. ${a.text}${site ? ` Review: ${site}/insights` : ''}`);
  }
}

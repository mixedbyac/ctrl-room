import { limit } from '@/lib/ratelimit';
import { admin, json, fail } from '@/lib/server';

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
  if (s.share_token !== b.t) {
    const { data: p } = await db.from('projects').select('id').eq('id', s.project_id).eq('share_token', b.t).maybeSingle();
    if (!p) return fail('Not shared.', 403);
  }
  const row = { listened: Math.max(0, +b.listened || 0), duration: +b.duration || null, bins: typeof b.bins === 'string' ? b.bins.slice(0, 2000) : null, updated_at: new Date().toISOString() };
  if (b.playId) {
    await db.from('plays').update(row).eq('id', b.playId).is('listener_email', null);
    return json({ id: b.playId });
  }
  const { data } = await db.from('plays').insert({ ...row, song_id: s.id, version_id: b.versionId || null, listener_email: null, device: String(b.device || '').slice(0, 60), source: 'from a share link' }).select('id').single();
  return json({ id: data?.id || null });
}

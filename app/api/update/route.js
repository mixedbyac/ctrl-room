import { SITE_URL } from '@/lib/site';
import { admin, engineerFrom, json, fail } from '@/lib/server';
import { emailClient } from '@/lib/invite';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Engineer: post one update to a song or to several songs in a project, and (optionally) email the artist's team once.
// { projectId, songIds: [...], body, email }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const body = String(b.body || '').trim().slice(0, 1000);
  const ids = Array.isArray(b.songIds) ? b.songIds.filter(Boolean).slice(0, 60) : [];
  if (!body) return fail('Write the update first.');
  if (!ids.length) return fail('Pick at least one song.');
  const db = admin();
  const { data: songs } = await db.from('songs').select('id, title, project_id, position').in('id', ids).order('position');
  if (!songs?.length) return fail('Unknown songs.', 404);
  const pid = b.projectId || songs[0].project_id;
  if (songs.some((s) => s.project_id !== pid)) return fail('Those songs are in different projects.');
  const { data: project } = await db.from('projects').select('*').eq('id', pid).single();
  let r = { sent: false, reason: '' };
  if (b.email) {
    const one = songs.length === 1;
    r = await emailClient(db, {
      song: one ? songs[0] : { id: songs[0].id, title: project?.title || songs[0].title },
      project, body: one || songs.length === (b.total || 0) ? body : `${body} (${songs.map((s) => s.title).join(', ')})`,
      origin: SITE_URL, linkPath: one ? `/s/${songs[0].id}` : `/p/${pid}`,
    }).catch((e) => ({ sent: false, reason: e.message }));
  }
  const { error } = await db.from('updates').insert(songs.map((s) => ({ song_id: s.id, body, texted: !!r.sent })));
  if (error) return fail(error.message, 500);
  return json({ ok: true, songs: songs.length, emailed: !!r.sent, count: r.count || 0, reason: r.sent ? '' : r.reason || '' });
}

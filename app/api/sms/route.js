import { admin, userFrom, isEngineer, json, fail } from '@/lib/server';
import { emailClient } from '@/lib/invite';

export const runtime = 'nodejs';

// Engineer only: send the artist's people an update about a song. By email (a text only if email isn't set up).
// (The route keeps its old name so nothing else has to change.)
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user))) return fail('Only the engineer can send updates.', 403);
  const b = await req.json().catch(() => null);
  if (!b?.songId || !String(b.body || '').trim()) return fail('Missing message.');
  const db = admin();
  const { data: s } = await db.from('songs').select('id,title,project_id').eq('id', b.songId).single();
  if (!s) return fail('Unknown song.', 404);
  const { data: p } = await db.from('projects').select('*').eq('id', s.project_id).single();
  const r = await emailClient(db, { song: s, project: p, body: String(b.body).trim(), origin: req.headers.get('origin') || '' });
  return json(r);
}

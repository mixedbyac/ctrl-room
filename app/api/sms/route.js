import { admin, userFrom, isEngineer, json, fail, sendText } from '@/lib/server';

export const runtime = 'nodejs';

// Engineer only: text the client on a song's project.
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user))) return fail('Only the engineer can send texts.', 403);
  const b = await req.json().catch(() => null);
  if (!b?.songId || !String(b.body || '').trim()) return fail('Missing message.');
  const db = admin();
  const { data: s } = await db.from('songs').select('id,title,project_id').eq('id', b.songId).single();
  if (!s) return fail('Unknown song.', 404);
  const { data: p } = await db.from('projects').select('phone').eq('id', s.project_id).single();
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const r = await sendText(p?.phone, `${s.title}: ${String(b.body).trim()}${site ? ` Listen: ${site}/s/${s.id}?from=text` : ''}`);
  return json(r);
}

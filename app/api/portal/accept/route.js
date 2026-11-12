import { admin, engineerFrom, json, fail } from '@/lib/server';
import { placeSend, isHeld } from '@/lib/heldsend';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Engineer: put a held Portal send on the app (makes or adds to the project, its songs and any demo). { uploadId }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: up } = await db.from('uploads').select('*').eq('id', b.uploadId).maybeSingle();
  if (!up) return fail('Unknown send.', 404);
  if (!isHeld(up)) return json({ projectId: up.project_id, songs: up.songs, already: true });
  try { return json(await placeSend(db, up)); }
  catch (e) { return fail(e.message, 500); }
}

import { limit } from '@/lib/ratelimit';
import { admin, userFrom, isEngineer, canSee, json, fail } from '@/lib/server';
import { recordDownload } from '@/lib/dlserver';

export const runtime = 'nodejs';

// The app tells us a client downloaded something, so the engineer hears about it. body: { versionIds: [] }
export async function POST(req) {
  const slow = limit(req, 'downloaded', 60, 600_000); if (slow) return slow;
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  if (await isEngineer(user)) return json({ ok: true, skipped: 'engineer' }); // your own downloads don't ping you
  const b = await req.json().catch(() => ({}));
  const ids = (Array.isArray(b.versionIds) ? b.versionIds : []).slice(0, 60);
  if (!ids.length) return fail('Nothing downloaded.');
  const db = admin();
  const { data: vs } = await db.from('versions').select('id, label, song_id, songs(id, title, project_id, projects(id, title, artist))').in('id', ids);
  const ok = [];
  for (const v of vs || []) if (v.songs && (await canSee(user, v.songs.project_id))) ok.push(v);
  if (!ok.length) return fail('Not found.', 404);
  const who = user.user_metadata?.display_name || user.user_metadata?.name || user.email;
  await recordDownload(db, { items: ok.map((v) => ({ song: v.songs, label: v.label })), who, project: ok[0].songs.projects, via: 'app' });
  return json({ ok: true });
}

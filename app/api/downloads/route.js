import { admin, engineerFrom, json, fail } from '@/lib/server';
import { emailDownloadsOn } from '@/lib/invite';

export const runtime = 'nodejs';

// Engineer: turn downloads on for a project (usually right after it's approved), and optionally email the client.
// body: { projectId, email: true|false }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: project } = await db.from('projects').select('*').eq('id', b.projectId).maybeSingle();
  if (!project) return fail('Unknown project.', 404);
  const { error } = await db.from('projects').update({ allow_download: true }).eq('id', project.id);
  if (error) return fail(/allow_download/.test(error.message) ? 'Run supabase/015_downloads.sql in Supabase first.' : error.message, 500);
  let mail = null;
  if (b.email) {
    const { data: songs } = await db.from('songs').select('title, status').eq('project_id', project.id).eq('status', 'approved').order('position');
    mail = await emailDownloadsOn(db, { project, songs: songs || [], from: user.email });
  }
  return json({ ok: true, mail });
}

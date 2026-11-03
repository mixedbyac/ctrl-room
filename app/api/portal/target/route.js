import { admin, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: what a project's Portal link (sendfileshere.com/?to=…) sends to. Just the names, nothing private.
export async function GET(req) {
  const to = new URL(req.url).searchParams.get('to') || '';
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(to)) return fail('This send link isn’t valid.', 404);
  const db = admin();
  const { data: p } = await db.from('projects').select('id, title, artist, archived').eq('settings->>portal_token', to).maybeSingle();
  if (!p || p.archived) return fail('This send link isn’t active anymore. Ask your engineer for a new one.', 404);
  const { data: songs } = await db.from('songs').select('title').eq('project_id', p.id).order('position');
  return json({ projectId: p.id, title: p.title, artist: p.artist, songs: (songs || []).map((s) => s.title) });
}

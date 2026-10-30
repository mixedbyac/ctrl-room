import { SITE_URL } from '@/lib/site';
import { admin, userFrom, isEngineer, canSee, newToken, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

const MIGRATE = 'Sharing needs a quick database update: run supabase/004_sharing_and_artists.sql in Supabase.';

// Get (or create) a share link, and for the engineer: turn sharing on/off or reset the link.
// body: { kind: 'song' | 'project', id, action?: 'link' | 'set' | 'reset', on? }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => null);
  if (!b?.id || !['song', 'project'].includes(b.kind)) return fail('Missing link details.');
  const db = admin();
  const table = b.kind === 'song' ? 'songs' : 'projects';
  const { data: row, error } = await db.from(table).select(b.kind === 'song' ? 'id, project_id, share_token, sharing' : 'id, share_token, sharing').eq('id', b.id).maybeSingle();
  if (error) return fail(/share_token|sharing/.test(error.message) ? MIGRATE : error.message, 500);
  if (!row) return fail('Not found.', 404);
  const projectId = b.kind === 'song' ? row.project_id : row.id;
  if (!(await canSee(user, projectId))) return fail('You don’t have access to this.', 403);
  const eng = await isEngineer(user);
  const { data: proj } = await db.from('projects').select('sharing').eq('id', projectId).single();
  const action = b.action || 'link';

  if (action === 'comments') {
    if (!eng) return fail('Only the engineer can change that.', 403);
    const { data: pr } = await db.from('projects').select('settings').eq('id', projectId).single();
    await db.from('projects').update({ settings: { ...(pr?.settings || {}), share_comments: !!b.on } }).eq('id', projectId);
  }
  if (action === 'downloads') {
    if (!eng) return fail('Only the engineer can change that.', 403);
    const { data: pr } = await db.from('projects').select('settings').eq('id', projectId).single();
    const mode = ['off', 'team', 'anyone'].includes(b.mode) ? b.mode : 'off';
    await db.from('projects').update({ settings: { ...(pr?.settings || {}), share_downloads: mode } }).eq('id', projectId);
  }
  if (action === 'set' || action === 'reset') {
    if (!eng) return fail('Only the engineer can change sharing.', 403);
    const patch = action === 'set' ? { sharing: !!b.on } : { share_token: newToken() };
    await db.from(table).update(patch).eq('id', b.id);
    if (action === 'set') row.sharing = !!b.on; else row.share_token = patch.share_token;
  }

  const allowed = proj?.sharing !== false && row.sharing !== false;
  const { data: pset } = await db.from('projects').select('settings').eq('id', projectId).single();
  const out = { allowed, sharing: row.sharing !== false, projectSharing: proj?.sharing !== false, comments: !!pset?.settings?.share_comments, downloads: pset?.settings?.share_downloads || 'off', url: null };
  if (!allowed) return json(out);
  let token = row.share_token;
  if (!token) {
    token = newToken();
    await db.from(table).update({ share_token: token }).eq('id', b.id);
  }
  const site = SITE_URL;
  out.url = `${site}/l/${token}`;
  return json(out);
}

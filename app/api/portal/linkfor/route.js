import { admin, engineerFrom, newToken, json, fail } from '@/lib/server';
import { PORTAL_URL } from '@/lib/site';

export const runtime = 'nodejs';

// Engineer: the Portal link for one project. Files sent with it go straight into that project. { projectId, reset? }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: p } = await db.from('projects').select('id, settings').eq('id', b.projectId).maybeSingle();
  if (!p) return fail('Unknown project.', 404);
  let token = p.settings?.portal_token;
  if (!token || b.reset) {
    token = newToken().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 14);
    await db.from('projects').update({ settings: { ...(p.settings || {}), portal_token: token } }).eq('id', p.id);
  }
  return json({ url: `${PORTAL_URL.replace(/\/$/, '')}/?to=${token}` });
}

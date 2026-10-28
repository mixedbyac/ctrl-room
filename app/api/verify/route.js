import { admin, userFrom, isEngineer, jwtClaims, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

async function findUser(db, email) {
  const e = String(email || '').toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data.users || []).find((u) => (u.email || '').toLowerCase() === e);
    if (hit) return hit;
    if ((data.users || []).length < 200) return null;
  }
  return null;
}

// Email confirmation for new accounts.
// { action: 'self' }                 the signed-in user just proved their email with a code or link
// { action: 'status', emails: [] }   engineer: which of these people have confirmed accounts
// { action: 'confirm', email }       engineer: confirm someone yourself (you know it's them)
export async function POST(req) {
  const slow = limit(req, 'verify', 30, 600_000); if (slow) return slow;
  const h = req.headers.get('authorization') || '';
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => ({}));
  const db = admin();

  if (!b.action || b.action === 'self') {
    const claims = jwtClaims(h.slice(7));
    const proof = (claims.amr || []).find((a) => ['otp', 'magiclink', 'email/signup', 'recovery'].includes(a.method));
    if (!proof || Date.now() / 1000 - (proof.timestamp || 0) > 30 * 60) return fail('Sign in with the code from your email first.', 403);
    await db.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), needs_verify: false } });
    return json({ ok: true });
  }
  if (!(await isEngineer(user.email))) return fail('Only the engineer can do that.', 403);
  if (b.action === 'status') {
    const out = {};
    for (const e of (b.emails || []).slice(0, 50)) {
      const u = await findUser(db, e);
      out[String(e).toLowerCase()] = !u ? 'none' : u.app_metadata?.needs_verify ? 'unconfirmed' : 'confirmed';
    }
    return json({ status: out });
  }
  if (b.action === 'confirm') {
    const u = await findUser(db, b.email);
    if (!u) return fail('No account with that email yet.', 404);
    await db.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata || {}), needs_verify: false } });
    return json({ ok: true });
  }
  return fail('Unknown action.');
}

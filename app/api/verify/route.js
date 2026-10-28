import { admin, userFrom, engineerFrom, jwtClaims, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const state = (u) => !u ? 'none' : u.app_metadata?.needs_verify ? 'unconfirmed' : (!u.email_confirmed_at && !u.app_metadata?.vouched) ? 'invited' : 'confirmed';
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
  if (!(await engineerFrom(req)).user) return fail('Only the engineer can do that.', 403);
  if (b.action === 'artists') {
    // per artist: how many of their people (project contacts + team) have confirmed accounts
    const people = {};
    const add = (artist, email) => { if (!artist || !email) return; const k = artist; (people[k] ||= new Set()).add(String(email).toLowerCase()); };
    const { data: ps } = await db.from('projects').select('artist, client_email');
    (ps || []).forEach((p) => add(p.artist, p.client_email));
    const { data: ms } = await db.from('artist_members').select('artist, email');
    (ms || []).forEach((m) => add(m.artist, m.email));
    const users = {};
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      (data.users || []).forEach((u) => { if (u.email) users[u.email.toLowerCase()] = state(u); });
      if ((data.users || []).length < 200) break;
    }
    const out = {};
    Object.entries(people).forEach(([a, set]) => {
      const list = [...set];
      out[a.toLowerCase()] = { total: list.length, verified: list.filter((e) => users[e] === 'confirmed').length, joined: list.filter((e) => users[e] && users[e] !== 'invited').length };
    });
    return json({ artists: out });
  }
  if (b.action === 'status') {
    const out = {};
    for (const e of (b.emails || []).slice(0, 50)) {
      const u = await findUser(db, e);
      out[String(e).toLowerCase()] = state(u);
    }
    return json({ status: out });
  }
  if (b.action === 'confirm') {
    // the engineer vouches for this email: they count as verified. No account yet? Email them an invite to join.
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email.');
    let u = await findUser(db, email), invited = false;
    if (!u) {
      const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/welcome`, data: b.artist ? { artist: b.artist } : {} });
      if (error) return fail(/rate|limit/i.test(error.message) ? 'Supabase’s email limit is reached for now. Try again in an hour, or send them the sign-up link.' : error.message, 500);
      u = data.user; invited = true;
    }
    await db.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata || {}), needs_verify: false, vouched: true } });
    return json({ ok: true, invited });
  }
  return fail('Unknown action.');
}

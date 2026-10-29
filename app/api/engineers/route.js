import { SITE_URL } from '@/lib/site';
import { admin, userFrom, isEngineer, isOwner, json, fail } from '@/lib/server';
import { invitePerson } from '@/lib/invite';

export const runtime = 'nodejs';

// Engineers on this CTRL ROOM. body: { action: 'list' | 'add' | 'remove', email? }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user))) return fail('Only engineers can see this.', 403);
  const owner = await isOwner(user.email);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: rows } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
  const list = (rows || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:'))
    .map((r) => ({ email: r.value, owner: r.key === 'engineer_email', key: r.key }));
  if (b.action === 'add' || b.action === 'remove') {
    if (!owner) return fail('Only the main engineer can change who’s an engineer.', 403);
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email.');
    if (b.action === 'add') {
      if (list.some((x) => x.email.toLowerCase() === email)) return fail('They’re already an engineer.');
      const { error } = await db.from('app_config').insert({ key: `engineer_email:${Date.now()}`, value: email });
      if (error) return fail(error.message, 500);
      // invite-only: email them a link to set up their engineer account (or a sign-in link if they already have one)
      const origin = SITE_URL;
      const r = await invitePerson(db, { email, origin, artist: '', invitedBy: user.email }).catch(() => null);
      if (r?.user) await db.auth.admin.updateUserById(r.user.id, { app_metadata: { ...(r.user.app_metadata || {}), needs_verify: false, vouched: true } });
      b.invite = r ? { sent: r.sent, link: r.link } : null;
    } else {
      const row = list.find((x) => x.email.toLowerCase() === email && !x.owner);
      if (!row) return fail('Can’t remove the main engineer.');
      await db.from('app_config').delete().eq('key', row.key);
    }
    const { data: again } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
    return json({ invite: b.invite || null, owner, list: (again || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:')).map((r) => ({ email: r.value, owner: r.key === 'engineer_email' })) });
  }
  return json({ owner, list: list.map(({ key, ...x }) => x) });
}

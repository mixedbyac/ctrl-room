import { admin, userFrom, isEngineer, needsVerify, json, fail } from '@/lib/server';
import { teamAdded } from '@/lib/invite';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ROLES = ['Artist', 'Admin', 'Manager', 'Producer', 'Writer', 'Label', 'A&R', 'Team', 'Other'];

/** Who can manage this artist's team: the engineer, or someone on it as the Artist or an Admin. */
async function manager(user, artist) {
  if (await isEngineer(user)) return { ok: true, eng: true, role: 'Engineer' };
  if (needsVerify(user)) return { ok: false };
  const { data } = await admin().from('artist_members').select('role, artist').ilike('artist', artist).ilike('email', user.email);
  const row = (data || []).find((x) => x.artist.toLowerCase() === artist.toLowerCase());
  return { ok: !!row && /^(admin|artist)$/i.test(row.role || ''), eng: false, role: row?.role || null };
}

// An artist's team. { action: 'list' | 'add' | 'role' | 'remove', artist, email?, role?, id? }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => ({}));
  const artist = String(b.artist || '').trim();
  if (!artist) return fail('Which artist?');
  const me = await manager(user, artist);
  if (!me.ok) return fail('Only the artist, their admins or the engineer can change this team.', 403);
  const db = admin();
  const rows = async () => {
    const { data } = await db.from('artist_members').select('*').ilike('artist', artist).order('added_at');
    return (data || []).filter((r) => r.artist.toLowerCase() === artist.toLowerCase());
  };
  // only the engineer or the artist themself can make someone “the Artist” (that's what verifies the artist page)
  const roleOk = (r) => ROLES.includes(r) && (r !== 'Artist' || me.eng || /^artist$/i.test(me.role || ''));
  if (b.action === 'add') {
    const email = String(b.email || '').trim().toLowerCase(), role = b.role || 'Team';
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email.');
    if (!roleOk(role)) return fail('Only the engineer or the artist can add someone as the Artist.', 403);
    const have = (await rows()).find((r) => r.email.toLowerCase() === email);
    if (have) return fail('They’re already on the team.');
    const { error } = await db.from('artist_members').insert({ artist, email, role });
    if (error) return fail(error.message, 500);
    const note = await teamAdded(db, { email, artist, role, by: user.email }).catch((e) => ({ sent: false, reason: e.message }));
    return json({ ok: true, list: await rows(), notified: !!note?.sent, link: note?.link || null });
  }
  if (b.action === 'role') {
    if (!roleOk(b.role)) return fail('Only the engineer or the artist can make someone the Artist.', 403);
    const r = (await rows()).find((x) => x.id === b.id);
    if (!r) return fail('Not on this team.', 404);
    await db.from('artist_members').update({ role: b.role }).eq('id', r.id);
    return json({ ok: true, list: await rows() });
  }
  if (b.action === 'remove') {
    const r = (await rows()).find((x) => x.id === b.id);
    if (!r) return fail('Not on this team.', 404);
    if (!me.eng && /^artist$/i.test(r.role || '') && !/^artist$/i.test(me.role || '')) return fail('Only the engineer or the artist can remove the Artist.', 403);
    await db.from('artist_members').delete().eq('id', r.id);
    return json({ ok: true, list: await rows() });
  }
  return json({ list: await rows(), canEdit: true, eng: me.eng, myRole: me.role });
}

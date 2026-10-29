import { admin, engineerFrom, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

// Engineer: everyone with a CTRL ROOM account (the "people book"), with the artists they're on.
// { action: 'list' } | { action: 'add', email, artist, role }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  if (b.action === 'add') {
    const email = String(b.email || '').trim().toLowerCase(), artist = String(b.artist || '').trim();
    if (!email || !artist) return fail('Pick an artist.');
    const { error } = await db.from('artist_members').insert({ artist, email, role: b.role || 'Admin' });
    if (error && !/duplicate|unique/i.test(error.message)) return fail(error.message, 500);
    return json({ ok: true });
  }
  const users = [];
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return fail(error.message, 500);
    users.push(...(data.users || []));
    if ((data.users || []).length < 200) break;
  }
  const { data: ms } = await db.from('artist_members').select('artist, email, role');
  const { data: ps } = await db.from('projects').select('artist, client_email');
  const { data: engs } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
  const engSet = new Set([(process.env.ENGINEER_EMAIL || '').toLowerCase(), ...(engs || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:')).map((r) => r.value.toLowerCase())].filter(Boolean));
  const teams = {};
  (ms || []).forEach((m) => { const e = m.email.toLowerCase(); (teams[e] ||= new Map()).set(m.artist.toLowerCase(), { artist: m.artist, role: m.role || 'Team' }); });
  (ps || []).forEach((p) => { if (!p.client_email) return; const e = p.client_email.toLowerCase(); const t = (teams[e] ||= new Map()); if (!t.has(p.artist.toLowerCase())) t.set(p.artist.toLowerCase(), { artist: p.artist, role: 'Contact' }); });
  const people = users.filter((u) => u.email).map((u) => {
    const e = u.email.toLowerCase(), md = u.user_metadata || {};
    const state = u.app_metadata?.needs_verify ? 'unconfirmed' : (!u.email_confirmed_at && !u.app_metadata?.vouched) ? 'invited' : 'verified';
    return {
      email: e, name: md.display_name || md.name || '', full_name: md.name || '', photo: md.avatar_url || null, artistHint: md.artist || '',
      engineer: engSet.has(e), state, joined: u.created_at, last: u.last_sign_in_at || null,
      artists: [...(teams[e]?.values() || [])],
    };
  }).sort((a, b) => (b.joined || '').localeCompare(a.joined || ''));
  return json({ people });
}

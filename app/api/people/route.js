import { admin, engineerFrom, json, fail } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import { accountEmails, invitePerson, signupNudge } from '@/lib/invite';

export const maxDuration = 60;

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
  // everyone CTRL ROOM has an email for (artist teams, project contacts, Portal senders) who has no account yet
  if (b.action === 'reach') {
    const accts = await accountEmails(db);
    const { data: engs } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
    const skip = new Set([(process.env.ENGINEER_EMAIL || '').toLowerCase(), ...(engs || []).map((r) => String(r.value).toLowerCase())]);
    const want = new Map();
    const put = (email, info) => { const e = String(email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e) || accts.has(e) || skip.has(e) || want.has(e)) return; want.set(e, { email: e, ...info }); };
    const { data: ms } = await db.from('artist_members').select('artist, email');
    (ms || []).forEach((m) => put(m.email, { artist: m.artist, kind: 'team' }));
    const { data: ps } = await db.from('projects').select('artist, client_email');
    (ps || []).forEach((p) => put(p.client_email, { artist: p.artist, kind: 'team' }));
    const { data: ups } = await db.from('uploads').select('email, name, artist').not('email', 'is', null).order('created_at', { ascending: false }).limit(500);
    (ups || []).forEach((u) => put(u.email, { artist: u.artist, name: u.name, kind: 'sender' }));
    const list = [...want.values()];
    if (!b.send) return json({ list });
    const pick = new Set((Array.isArray(b.emails) ? b.emails : list.map((x) => x.email)).map((e) => String(e).toLowerCase()));
    const out = [];
    for (const x of list.filter((x) => pick.has(x.email)).slice(0, 40)) {
      // people already on an artist's team get a real invite (they land straight in their projects); Portal senders get a sign-up nudge
      const r = x.kind === 'team'
        ? await invitePerson(db, { email: x.email, origin: SITE_URL, artist: x.artist, invitedBy: user.email }).catch((e) => ({ sent: false, reason: e.message }))
        : await signupNudge(db, { email: x.email, name: x.name, artist: x.artist, reason: 'files' }).catch((e) => ({ sent: false, reason: e.message }));
      out.push({ email: x.email, sent: !!r.sent, reason: r.sent ? '' : r.reason || '' });
      await new Promise((res) => setTimeout(res, 550)); // the email service allows ~2 a second
    }
    try { // remember who got one, so the daily reminder doesn't email them again
      const { getConfig, setConfig } = await import('@/lib/server');
      const done = JSON.parse((await getConfig('signup_reminders')) || '{}');
      out.filter((x) => x.sent).forEach((x) => { done[x.email] = new Date().toISOString().slice(0, 10); });
      await setConfig('signup_reminders', JSON.stringify(done));
    } catch {}
    return json({ sent: out.filter((x) => x.sent).length, failed: out.filter((x) => !x.sent), more: Math.max(0, pick.size - 40) });
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
      email: e, name: md.display_name || md.name || '', full_name: md.name || '', photo: md.avatar_url || null, artistHint: md.artist || '', title: md.title || '',
      engineer: engSet.has(e), state, joined: u.created_at, last: u.last_sign_in_at || null,
      artists: [...(teams[e]?.values() || [])],
    };
  }).sort((a, b) => (b.joined || '').localeCompare(a.joined || ''));
  return json({ people });
}

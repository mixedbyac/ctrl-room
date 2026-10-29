import { SITE_URL } from '@/lib/site';
import { admin, engineerFrom, json, fail } from '@/lib/server';
import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';
import { invitePerson, sendEmail } from '@/lib/invite';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Engineer adds an artist by hand and invites people to join. body: { artist, emails: [], spotify?, role? }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  if (b.test) {
    const r = await sendEmail({ to: user.email, subject: 'CTRL ROOM test email', html: '<p style="font-family:-apple-system,Helvetica,Arial">This is a test from CTRL ROOM. If you got it, email is working.</p>', text: 'This is a test from CTRL ROOM. If you got it, email is working.' });
    return json(r);
  }
  if (b.log) { const { getConfig } = await import('@/lib/server'); return json({ log: JSON.parse((await getConfig('email_log')) || '[]') }); }
  if (b.check) return json({ email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), from: process.env.EMAIL_FROM || null, hasKey: !!process.env.RESEND_API_KEY, hasFrom: !!process.env.EMAIL_FROM });
  let artist = String(b.artist || '').trim().slice(0, 100);
  const emails = [...new Set((Array.isArray(b.emails) ? b.emails : String(b.emails || '').split(/[\s,;]+/)).map((e) => String(e).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  const role = ['Admin', 'Artist', 'Manager', 'Team'].includes(b.role) ? b.role : 'Admin';
  const spotify = String(b.spotify || '').trim().slice(0, 300);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const vouch = b.verify !== false;
  const artistEmail = String(b.artistEmail || '').trim().toLowerCase(); // you know these people: they count as verified straight away
  if (!artist) return fail('Add the artist name.');
  const bad = emails.find((e) => !/^\S+@\S+\.\S+$/.test(e));
  if (bad) return fail(`“${bad}” doesn’t look like an email.`);
  const db = admin();

  // the artist page (with Spotify details when given)
  const { data: cur } = await db.from('artists').select('id, spotify_url').ilike('name', artist).maybeSingle();
  let row = { name: artist };
  if (spotifyArtistId(spotify) && !cur?.spotify_url) {
    try { const sp = await fetchSpotifyArtist(spotify); if (sp.display_name && !cur) artist = sp.display_name.trim(); row = { ...row, name: artist, spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, display_name: sp.display_name, image_url: sp.image_url, header_url: sp.header_url, bio: sp.bio, listeners: sp.listeners, genres: sp.genres, followers: sp.followers }; } catch {}
  }
  let up = cur ? await db.from('artists').update({ ...row, name: undefined, updated_at: new Date().toISOString() }).eq('id', cur.id) : await db.from('artists').insert(row);
  if (up.error && /duplicate|unique/i.test(up.error.message)) up = await db.from('artists').update({ ...row, name: undefined, updated_at: new Date().toISOString() }).ilike('name', artist);
  if (up.error && !/column/i.test(up.error.message)) return fail(up.error.message, 500);

  const origin = SITE_URL;
  const results = [];
  for (const email of emails) {
    const { error: mErr } = await db.from('artist_members').insert({ artist, email, role: email === artistEmail ? 'Artist' : role });
    if (mErr && /duplicate|unique/i.test(mErr.message) && email === artistEmail) await db.from('artist_members').update({ role: 'Artist' }).ilike('artist', artist).ilike('email', email);
    if (mErr && !/duplicate|unique/i.test(mErr.message)) { results.push({ email, status: 'error', message: mErr.message }); continue; }
    const r = await invitePerson(db, { email, origin, artist, invitedBy: user.email, phone: emails.length === 1 ? phone : '' });
    let u = r.user;
    if (!u && r.status !== 'link') {
      for (let page = 1; page <= 20 && !u; page++) {
        const { data: d } = await db.auth.admin.listUsers({ page, perPage: 200 });
        u = (d?.users || []).find((x) => (x.email || '').toLowerCase() === email) || null;
        if ((d?.users || []).length < 200) break;
      }
    }
    if (vouch && u) await db.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata || {}), needs_verify: false, vouched: true } });
    results.push({ email, status: r.status, link: r.link, sent: r.sent, texted: r.texted, verified: vouch && !!u,
      message: r.sent ? (r.reason === 'supabase' ? 'Sent by Supabase’s built-in email (it only reaches your Supabase team). Copy the link to be safe.' : '') : r.reason === 'not-set-up' ? 'Email isn’t set up yet. Copy the link and text it to them.' : r.reason });
  }
  return json({ ok: true, artist, results, email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) });
}

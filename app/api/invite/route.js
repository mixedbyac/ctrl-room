import { admin, engineerFrom, json, fail } from '@/lib/server';
import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Engineer adds an artist by hand and invites people to join. body: { artist, emails: [], spotify?, role? }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const artist = String(b.artist || '').trim().slice(0, 100);
  const emails = [...new Set((Array.isArray(b.emails) ? b.emails : String(b.emails || '').split(/[\s,;]+/)).map((e) => String(e).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  const role = ['Admin', 'Artist', 'Manager', 'Team'].includes(b.role) ? b.role : 'Admin';
  const spotify = String(b.spotify || '').trim().slice(0, 300);
  if (!artist) return fail('Add the artist name.');
  const bad = emails.find((e) => !/^\S+@\S+\.\S+$/.test(e));
  if (bad) return fail(`“${bad}” doesn’t look like an email.`);
  const db = admin();

  // the artist page (with Spotify details when given)
  const { data: cur } = await db.from('artists').select('id, spotify_url').ilike('name', artist).maybeSingle();
  let row = { name: artist };
  if (spotifyArtistId(spotify) && !cur?.spotify_url) {
    try { const sp = await fetchSpotifyArtist(spotify); row = { ...row, spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, display_name: sp.display_name, image_url: sp.image_url, header_url: sp.header_url, bio: sp.bio, listeners: sp.listeners, genres: sp.genres, followers: sp.followers }; } catch {}
  }
  const up = cur ? await db.from('artists').update({ ...row, name: undefined, updated_at: new Date().toISOString() }).eq('id', cur.id) : await db.from('artists').insert(row);
  if (up.error && !/column/i.test(up.error.message)) return fail(up.error.message, 500);

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
  const results = [];
  for (const email of emails) {
    const { error: mErr } = await db.from('artist_members').insert({ artist, email, role });
    if (mErr && !/duplicate|unique/i.test(mErr.message)) { results.push({ email, status: 'error', message: mErr.message }); continue; }
    const signup = `${origin}/signup?email=${encodeURIComponent(email)}&artist=${encodeURIComponent(artist)}`;
    const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/welcome`, data: { artist, invited_by: user.email } });
    if (!error) { results.push({ email, status: 'invited', link: signup }); continue; }
    if (/already|registered|exists/i.test(error.message)) results.push({ email, status: 'existing' });
    else results.push({ email, status: 'link', link: signup, message: /rate|limit/i.test(error.message) ? 'Email limit reached, send them the link instead.' : error.message });
  }
  return json({ ok: true, artist, results });
}

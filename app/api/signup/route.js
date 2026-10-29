import { admin, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';
import { notifyEngineers } from '@/lib/invite';
import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Creates a client account with a password. No confirmation email, so it never hits email limits.
export async function POST(req) {
  const slow = limit(req, 'signup', 5, 3600_000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim().slice(0, 100);
  const artist = String(b?.artist || '').trim().slice(0, 100);
  const email = String(b?.email || '').trim().toLowerCase();
  const phone = String(b?.phone || '').trim().slice(0, 30);
  const spotify = String(b?.spotify || '').trim().slice(0, 300);
  const password = String(b?.password || '');
  if (!name) return fail('Add your name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
  if (password.length < 8) return fail('Use a password with at least 8 characters.');
  if (b?.website) return json({ ok: true }); // bots fill hidden fields

  const db = admin();
  // engineers are invite-only: their account comes from the invite email, never from this form
  const { data: engs } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
  if ((engs || []).some((r) => r.value.toLowerCase() === email) || (process.env.ENGINEER_EMAIL || '').toLowerCase() === email) {
    return fail('This email has engineer access, which is invite-only. Use the invite email you were sent, or sign in.');
  }
  const { error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, artist, phone, spotify },
    app_metadata: { needs_verify: true }, // projects unlock after the email is confirmed (code) or the engineer confirms them
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return fail('There’s already an account with this email. Sign in instead, or use “Email me a sign-in link” if you forgot the password.', 409);
    return fail(error.message, 500);
  }

  // get their artist page ready (best effort, never blocks sign-up)
  if (artist && spotifyArtistId(spotify)) {
    try {
      const { data: cur } = await db.from('artists').select('id, spotify_url').ilike('name', artist).maybeSingle();
      if (!cur?.spotify_url) {
        const sp = await fetchSpotifyArtist(spotify);
        const row = { spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, display_name: sp.display_name, image_url: sp.image_url, header_url: sp.header_url, bio: sp.bio, listeners: sp.listeners, genres: sp.genres, followers: sp.followers, updated_at: new Date().toISOString() };
        if (cur) await db.from('artists').update(row).eq('id', cur.id); else await db.from('artists').insert({ name: artist, ...row });
      }
    } catch {}
  }
  // let the engineer know (email + text when set up)
  await notifyEngineers(db, { name, email, artist, how: 'signup', origin: req.headers.get('origin') || `https://${req.headers.get('host')}` });
  return json({ ok: true });
}

import { getConfig } from '@/lib/server';
import { roleForTitle } from '@/lib/titles';

/**
 * Once someone confirms their email, put them on the artists they already sent files for or are the contact of,
 * with the role that fits what they do (Artist → the artist themself, verified). Only artists their own email is
 * already tied to, so nobody can claim an artist just by typing its name.
 */
export async function autoJoin(db, user) {
  try {
    const e = String(user?.email || '').toLowerCase();
    if (!e) return [];
    const artists = new Map();
    const { data: ps } = await db.from('projects').select('artist').ilike('client_email', e);
    (ps || []).forEach((p) => p.artist && artists.set(p.artist.toLowerCase(), p.artist));
    const { data: ups } = await db.from('uploads').select('artist').ilike('email', e);
    (ups || []).forEach((u) => u.artist && artists.set(u.artist.toLowerCase(), u.artist));
    if (!artists.size) return [];
    const title = user.user_metadata?.title || (await getConfig(`sender_title:${e}`)) || '';
    const role = roleForTitle(title);
    const { data: ms } = await db.from('artist_members').select('id, artist, role').ilike('email', e);
    const joined = [];
    for (const artist of artists.values()) {
      const have = (ms || []).find((m) => m.artist.toLowerCase() === artist.toLowerCase());
      if (!have) { const { error } = await db.from('artist_members').insert({ artist, email: e, role }); if (!error) joined.push({ artist, role }); }
      else if (role === 'Artist' && !/^(artist|admin)$/i.test(have.role || '')) { await db.from('artist_members').update({ role }).eq('id', have.id); joined.push({ artist, role }); }
    }
    return joined;
  } catch { return []; }
}

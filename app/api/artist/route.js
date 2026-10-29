import { admin, userFrom, isEngineer, onTeam, json, fail } from '@/lib/server';
import { fetchSpotifyArtist } from '@/lib/spotify';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MIGRATE = 'Artist pages need a quick database update: run supabase/004_sharing_and_artists.sql in Supabase.';
const FIELDS = ['display_name', 'bio', 'spotify_url', 'accent'];

async function canEdit(email, name) {
  if (await isEngineer(email)) return true;
  const { data } = await admin().from('projects').select('id').ilike('artist', name).ilike('client_email', email).limit(1);
  return !!data?.length || onTeam(email, name);
}

async function upsert(db, name, patch) {
  const { data: cur, error } = await db.from('artists').select('*').ilike('name', name).maybeSingle();
  if (error) throw new Error(/artists/.test(error.message) ? MIGRATE : error.message);
  const row = { ...patch, updated_at: new Date().toISOString() };
  const res = cur
    ? await db.from('artists').update(row).eq('id', cur.id).select('*').single()
    : await db.from('artists').insert({ name, ...row }).select('*').single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Artist profiles. body: { name, action: 'spotify' | 'save' | 'image' | 'clear', ... }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim();
  if (!name) return fail('Which artist?');
  if (user.app_metadata?.needs_verify && !(await isEngineer(user))) return fail('Confirm your email first.', 403);
  if (!(await canEdit(user.email, name))) return fail('You can only edit your own artist page.', 403);
  const db = admin();
  try {
    if (b.action === 'spotify') {
      const sp = await fetchSpotifyArtist(b.url);
      const { data: cur } = await db.from('artists').select('*').ilike('name', name).maybeSingle();
      // keep anything the artist wrote or uploaded themselves
      const patch = { spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, listeners: sp.listeners, genres: sp.genres, followers: sp.followers };
      const own = cur?.links || {};
      if (!own.custom_name) patch.display_name = sp.display_name;
      if (!own.custom_image && sp.image_url) patch.image_url = sp.image_url;
      if (!own.custom_header) patch.header_url = sp.header_url || null;
      if (!own.custom_bio && sp.bio) patch.bio = sp.bio;
      return json({ artist: await upsert(db, name, patch), found: { header: !!sp.header_url, bio: !!sp.bio } });
    }
    if (b.action === 'save') {
      const { data: cur } = await db.from('artists').select('links').ilike('name', name).maybeSingle();
      const patch = {}; const links = { ...(cur?.links || {}) };
      for (const k of FIELDS) if (k in b) patch[k] = b[k] == null ? null : String(b[k]).slice(0, k === 'bio' ? 1500 : 200).trim() || null;
      if ('display_name' in b) links.custom_name = !!patch.display_name;
      if ('bio' in b) links.custom_bio = !!patch.bio;
      patch.links = links;
      return json({ artist: await upsert(db, name, patch) });
    }
    if (b.action === 'image') {
      const kind = b.kind === 'header' ? 'header' : 'image';
      const m = String(b.dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) return fail('Upload a JPG, PNG or WebP image.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 4 * 1024 * 1024) return fail('That image is too big. Try one under 4 MB.');
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artist';
      const path = `artists/${slug}/${kind}-${Date.now()}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`;
      const up = await db.storage.from('art').upload(path, buf, { contentType: m[1], upsert: true });
      if (up.error) return fail(/not found/i.test(up.error.message) ? MIGRATE : up.error.message, 500);
      const url = db.storage.from('art').getPublicUrl(path).data.publicUrl;
      const { data: cur } = await db.from('artists').select('links').ilike('name', name).maybeSingle();
      const links = { ...(cur?.links || {}), [kind === 'header' ? 'custom_header' : 'custom_image']: true };
      return json({ artist: await upsert(db, name, { [kind === 'header' ? 'header_url' : 'image_url']: url, links }) });
    }
    if (b.action === 'clear') {
      const kind = b.kind === 'header' ? 'header' : 'image';
      const { data: cur } = await db.from('artists').select('links').ilike('name', name).maybeSingle();
      const links = { ...(cur?.links || {}) }; delete links[kind === 'header' ? 'custom_header' : 'custom_image'];
      return json({ artist: await upsert(db, name, { [kind === 'header' ? 'header_url' : 'image_url']: null, links }) });
    }
    return fail('Unknown action.');
  } catch (e) {
    return fail(e.message || 'Something went wrong.', 500);
  }
}

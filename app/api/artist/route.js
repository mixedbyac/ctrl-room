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

/** Rename an artist everywhere: projects, team, Portal sends and the artist page (merging into an existing page of that name). */
async function renameArtist(db, from, to) {
  await db.from('projects').update({ artist: to }).ilike('artist', from);
  await db.from('uploads').update({ artist: to }).ilike('artist', from).then(() => {}, () => {});
  const { data: ms } = await db.from('artist_members').select('*').ilike('artist', from);
  for (const m of ms || []) {
    const { error } = await db.from('artist_members').update({ artist: to }).eq('id', m.id);
    if (error) await db.from('artist_members').delete().eq('id', m.id); // already on the other name's team
  }
  const { data: rows } = await db.from('artists').select('id, name').or(`name.ilike.${from.replace(/[,()]/g, '')},name.ilike.${to.replace(/[,()]/g, '')}`);
  const old = (rows || []).find((r) => r.name.toLowerCase() === from.toLowerCase());
  const target = (rows || []).find((r) => r.name.toLowerCase() === to.toLowerCase() && r.id !== old?.id);
  if (old && target) {
    const { data: full } = await db.from('artists').select('*').eq('id', old.id).single();
    const { id, name, ...rest } = full || {};
    await db.from('artists').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', target.id);
    await db.from('artists').delete().eq('id', old.id);
  } else if (old) await db.from('artists').update({ name: to }).eq('id', old.id);
  return to;
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
      const own = { ...(cur?.links || {}) };
      // Spotify wins for the name and bio (you can still edit them afterwards); your own photo/header stay
      if (sp.display_name) { patch.display_name = sp.display_name; own.custom_name = false; }
      if (sp.bio) { patch.bio = sp.bio; own.custom_bio = false; }
      if (!own.custom_image && sp.image_url) patch.image_url = sp.image_url;
      if (!own.custom_header) patch.header_url = sp.header_url || null;
      patch.links = own;
      const saved = await upsert(db, name, patch);
      // the engineer: rename the artist everywhere to their Spotify name (projects, team, Portal sends)
      let renamed = null;
      if (sp.display_name && sp.display_name.trim() !== name && (await isEngineer(user))) {
        renamed = await renameArtist(db, name, sp.display_name.trim()).catch(() => null);
      }
      const { data: fresh } = await db.from('artists').select('*').ilike('name', renamed || name).maybeSingle();
      return json({ artist: fresh || saved, renamed, found: { header: !!sp.header_url, bio: !!sp.bio } });
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

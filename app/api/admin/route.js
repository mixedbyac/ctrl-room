import { admin, userFrom, isEngineer, needsVerify, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/** Is this user an Admin on the team of the artist who owns the project? (or the engineer) */
async function canAdmin(user, projectId) {
  if (await isEngineer(user.email)) return true;
  if (needsVerify(user)) return false;
  const db = admin();
  const { data: p } = await db.from('projects').select('artist').eq('id', projectId).maybeSingle();
  if (!p) return false;
  const { data: m } = await db.from('artist_members').select('email, role, artist').ilike('artist', p.artist);
  return (m || []).some((x) => x.email.toLowerCase() === user.email.toLowerCase() && x.artist.toLowerCase() === p.artist.toLowerCase() && /^admin$/i.test(x.role || ''));
}

// Artist admins (and the engineer): cover art, track order, active version, song titles.
// body: { action, projectId, songId?, ... }
export async function POST(req) {
  const slow = limit(req, 'admin', 120, 600_000); if (slow) return slow;
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  let projectId = b.projectId;
  let song = null;
  if (b.songId) {
    const { data } = await db.from('songs').select('id, project_id').eq('id', b.songId).maybeSingle();
    if (!data) return fail('Unknown song.', 404);
    song = data; projectId = data.project_id;
  }
  if (!projectId || !(await canAdmin(user, projectId))) return fail('Only the engineer or an artist admin can change that.', 403);
  const table = b.table === 'songs' ? 'songs' : 'projects';
  const rowId = table === 'songs' ? b.songId : projectId;

  switch (b.action) {
    case 'cover': { // { table, patch: { seed?, cover_path? } }
      const patch = {};
      if (b.patch && 'seed' in b.patch) patch.seed = Math.floor(Number(b.patch.seed)) || 1;
      if (b.patch && 'cover_path' in b.patch) {
        const cp = b.patch.cover_path;
        if (cp && !String(cp).startsWith('gen:') && !String(cp).startsWith(`${projectId}/covers/`)) return fail('That image isn’t part of this project.', 400);
        patch.cover_path = cp || null;
      }
      const { error } = await db.from(table).update(patch).eq('id', rowId);
      return error ? fail(error.message, 500) : json({ ok: true });
    }
    case 'cover-upload': { // { table, ext } -> signed upload for a cover image
      const ext = String(b.ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      const path = `${projectId}/covers/${table}-${rowId}-${Date.now()}.${ext}`;
      const { data, error } = await db.storage.from('mixes').createSignedUploadUrl(path);
      return error ? fail(error.message, 500) : json({ path, token: data.token });
    }
    case 'order': { // { order: [songId, ...] }
      const ids = Array.isArray(b.order) ? b.order.slice(0, 200) : [];
      const { data: songs } = await db.from('songs').select('id').eq('project_id', projectId);
      const mine = new Set((songs || []).map((x) => x.id));
      for (let i = 0; i < ids.length; i++) if (mine.has(ids[i])) await db.from('songs').update({ position: i }).eq('id', ids[i]);
      return json({ ok: true });
    }
    case 'active': { // { songId, versionId|null }
      if (!song) return fail('Which song?');
      if (b.versionId) {
        const { data: v } = await db.from('versions').select('id').eq('id', b.versionId).eq('song_id', song.id).maybeSingle();
        if (!v) return fail('Unknown version.', 404);
      }
      const { error } = await db.from('songs').update({ active_version: b.versionId || null }).eq('id', song.id);
      return error ? fail(/active_version/.test(error.message) ? 'Run supabase/011_admins.sql in Supabase first.' : error.message, 500) : json({ ok: true });
    }
    case 'title': { // { songId?, title } -> song or project title
      const t = String(b.title || '').trim().slice(0, 120);
      if (!t) return fail('Add a title.');
      const { error } = song ? await db.from('songs').update({ title: t }).eq('id', song.id) : await db.from('projects').update({ title: t }).eq('id', projectId);
      return error ? fail(error.message, 500) : json({ ok: true });
    }
    default: return fail('Unknown action.');
  }
}

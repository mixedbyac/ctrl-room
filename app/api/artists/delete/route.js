import { admin, engineerFrom, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Engineer removes an artist: their page and team. projects: 'archive' (default, keeps the music) or 'delete' (everything goes).
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const name = String(b.artist || '').trim();
  if (!name) return fail('Which artist?');
  const db = admin();
  const { data: projects } = await db.from('projects').select('id').ilike('artist', name);
  const ids = (projects || []).map((p) => p.id);
  if (ids.length && b.projects === 'delete') {
    for (const pid of ids) {
      // stored files first (mixes, demos, covers, receipts), then the project (songs, versions and notes go with it)
      try {
        const { data: songs } = await db.from('songs').select('id').eq('project_id', pid);
        for (const f of ['', 'covers', 'receipts', ...(songs || []).map((x) => x.id)]) {
          const prefix = f ? `${pid}/${f}` : pid;
          const { data: files } = await db.storage.from('mixes').list(prefix, { limit: 1000 });
          const paths = (files || []).filter((x) => x.id).map((x) => `${prefix}/${x.name}`);
          if (paths.length) await db.storage.from('mixes').remove(paths);
        }
      } catch {}
      const { error } = await db.from('projects').delete().eq('id', pid);
      if (error) return fail(error.message, 500);
    }
  } else if (ids.length) {
    await db.from('projects').update({ archived: true }).in('id', ids);
  }
  await db.from('artist_members').delete().ilike('artist', name);
  await db.from('artists').delete().ilike('name', name);
  return json({ ok: true, projects: ids.length, mode: ids.length ? (b.projects === 'delete' ? 'deleted' : 'archived') : 'none' });
}

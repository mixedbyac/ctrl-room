import { admin } from '@/lib/server';
import { creditLine } from '@/lib/credit';

/** What a share link is, for link previews (iMessage, Instagram, WhatsApp…). Null if the link is off or unknown. */
export async function shareInfo(token) {
  if (!token || String(token).length > 40) return null;
  const db = admin();
  let song = null, project = null;
  ({ data: song } = await db.from('songs').select('*').eq('share_token', token).maybeSingle());
  if (song) {
    if (song.sharing === false) return null;
    ({ data: project } = await db.from('projects').select('*').eq('id', song.project_id).single());
  } else {
    ({ data: project } = await db.from('projects').select('*').eq('share_token', token).maybeSingle());
  }
  if (!project || project.sharing === false || project.archived) return null;
  const { data: art } = await db.from('artists').select('display_name, image_url').ilike('name', project.artist).maybeSingle().then((r) => r, () => ({ data: null }));
  const own = song?.cover_path, gen = own && String(own).startsWith('gen:');
  const path = gen ? null : own || project.cover_path || null;
  let cover = null;
  if (path) { const { data } = await db.storage.from('mixes').createSignedUrl(path, 60 * 60 * 24 * 7); cover = data?.signedUrl || null; }
  let credit = '';
  try {
    const want = String(project.settings?.engineer || '').toLowerCase();
    const { data: eps } = await db.from('engineer_profiles').select('*');
    const e = (want && (eps || []).find((x) => x.email === want)) || (eps || []).find((x) => x.is_main);
    if (e) credit = creditLine(e);
  } catch {}
  let count = 0;
  if (!song) { const { count: n } = await db.from('songs').select('id', { head: true, count: 'exact' }).eq('project_id', project.id); count = n || 0; }
  return {
    kind: song ? 'song' : 'project',
    title: song ? song.title : project.title,
    project: project.title,
    artist: art?.display_name || project.artist,
    artistImage: art?.image_url || null,
    cover, coverPath: path, seed: gen ? Number(own.slice(4)) || song.seed : own ? song.seed : project.seed,
    credit, count,
  };
}

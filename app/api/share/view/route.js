import { admin, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));
const pickVersion = (s, vs) => vs.find((v) => v.id === s.approved_version) || vs.filter((v) => !isDemo(v)).at(-1) || vs[vs.length - 1];

// Public: what a share link plays. Only the shared song/project, only its current mix, no notes.
export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t');
  if (!t || t.length > 40) return fail('This link isn’t valid.', 404);
  const db = admin();
  let project, songs;
  const { data: song } = await db.from('songs').select('*').eq('share_token', t).maybeSingle();
  if (song) {
    if (song.sharing === false) return fail('Sharing is turned off for this song.', 403);
    ({ data: project } = await db.from('projects').select('*').eq('id', song.project_id).single());
    songs = [song];
  } else {
    ({ data: project } = await db.from('projects').select('*').eq('share_token', t).maybeSingle());
    if (!project) return fail('This link isn’t valid anymore.', 404);
    ({ data: songs } = await db.from('songs').select('*').eq('project_id', project.id).neq('sharing', false).order('position'));
  }
  if (!project || project.sharing === false || project.archived) return fail('Sharing is turned off for this project.', 403);

  const ids = (songs || []).map((s) => s.id);
  const { data: allV } = ids.length ? await db.from('versions').select('*').in('song_id', ids).order('created_at') : { data: [] };
  const list = [];
  for (const s of songs || []) {
    const vs = (allV || []).filter((v) => v.song_id === s.id);
    if (!vs.length) continue;
    const v = pickVersion(s, vs);
    const { data: u } = await db.storage.from('mixes').createSignedUrl(v.storage_path, 60 * 60 * 6);
    if (!u?.signedUrl) continue;
    // same artwork rule as the app: the project's cover unless the song has its own
    const own = s.cover_path, gen = own && own.startsWith('gen:');
    const artPath = gen ? null : own || project.cover_path || null;
    const artSeed = gen ? Number(own.slice(4)) || s.seed : own ? s.seed : project.seed;
    let cover = null;
    if (artPath) {
      const { data: c } = await db.storage.from('mixes').createSignedUrl(artPath, 60 * 60 * 6);
      cover = c?.signedUrl || null;
    }
    list.push({ id: s.id, title: s.title, seed: artSeed, cover, approved: s.status === 'approved',
      version: { id: v.id, label: v.label, duration: v.duration, peaks: v.peaks, url: u.signedUrl, file_format: v.file_format, bit_depth: v.bit_depth, sample_rate: v.sample_rate } });
  }
  let pcover = null;
  if (project.cover_path) { const { data: c } = await db.storage.from('mixes').createSignedUrl(project.cover_path, 60 * 60 * 6); pcover = c?.signedUrl || null; }
  const { data: artist } = await db.from('artists').select('name, display_name, image_url, header_url, bio, spotify_url, accent').ilike('name', project.artist).maybeSingle().then((r) => r, () => ({ data: null }));
  return json({
    kind: song ? 'song' : 'project',
    project: { title: project.title, artist: project.artist, type: project.type, release: project.release, seed: project.seed, cover: pcover },
    artist: artist || null,
    songs: list,
  });
}

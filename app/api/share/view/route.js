import { limit } from '@/lib/ratelimit';
import { admin, json, fail } from '@/lib/server';
import { creditLine } from '@/lib/credit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));
const pickVersion = (s, vs) => vs.find((v) => v.id === s.active_version) || vs.find((v) => v.id === s.approved_version) || vs.filter((v) => !isDemo(v)).at(-1) || vs[vs.length - 1];

// Public: what a share link plays. Only the shared song/project, only its current mix, no notes.
export async function GET(req) {
  const slow = limit(req, 'share-view', 120, 600000); if (slow) return slow;
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
  const { data: lockInv } = await db.from('invoices').select('id').eq('project_id', project.id).eq('lock', true).eq('status', 'unpaid').limit(1).then((r) => r, () => ({ data: null }));
  if (lockInv?.length) return fail('This music isn’t available right now.', 403);

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
    // every version, so people on the link can flip between them (on unless the engineer turned it off)
    let vlist = null;
    if (project.settings?.share_versions !== false && vs.length > 1) {
      const { data: us } = await db.storage.from('mixes').createSignedUrls(vs.map((x) => x.storage_path), 60 * 60 * 6);
      const shape = (x, url) => ({ id: x.id, label: x.label, duration: x.duration, peaks: x.peaks, url, file_format: x.file_format, bit_depth: x.bit_depth, sample_rate: x.sample_rate, created_at: x.created_at, demo: isDemo(x) });
      const act = v.id;
      // match links by file path (not position), and sign one-by-one anything the batch missed
      const byPath = new Map((us || []).filter((u) => u?.signedUrl).map((u) => [u.path, u.signedUrl]));
      for (const x of vs) if (!byPath.has(x.storage_path) && x.storage_path) { const { data: one } = await db.storage.from('mixes').createSignedUrl(x.storage_path, 60 * 60 * 6); if (one?.signedUrl) byPath.set(x.storage_path, one.signedUrl); }
      vlist = vs.map((x) => (byPath.get(x.storage_path) ? shape(x, byPath.get(x.storage_path)) : null)).filter(Boolean)
        .sort((a, b) => (a.id === act ? -1 : b.id === act ? 1 : a.demo !== b.demo ? (a.demo ? 1 : -1) : String(b.created_at).localeCompare(String(a.created_at))));
    }
    list.push({ id: s.id, title: s.title, seed: artSeed, cover, approved: s.status === 'approved', approvedVersion: s.approved_version || null, vlist,
      bpm: s.bpm || null, key: s.musical_key || null, versions: vs.filter((x) => !isDemo(x)).length,
      steps: { received: s.received_at || null, mixing: s.mixing_at || null, review: (vs.filter((x) => !isDemo(x)).at(-1)?.created_at || '').slice(0, 10) || null, approved: s.approved_at ? String(s.approved_at).slice(0, 10) : null },
      version: { id: v.id, label: v.label, duration: v.duration, peaks: v.peaks, url: u.signedUrl, file_format: v.file_format, bit_depth: v.bit_depth, sample_rate: v.sample_rate, created_at: v.created_at } });
  }
  let pcover = null;
  if (project.cover_path) { const { data: c } = await db.storage.from('mixes').createSignedUrl(project.cover_path, 60 * 60 * 6); pcover = c?.signedUrl || null; }
  const { data: artist } = await db.from('artists').select('name, display_name, image_url, header_url, bio, spotify_url, accent').ilike('name', project.artist).maybeSingle().then((r) => r, () => ({ data: null }));
  let credit = null;
  try {
    const want = String(project.settings?.engineer || '').toLowerCase();
    const { data: eps } = await db.from('engineer_profiles').select('*');
    const e = (want && (eps || []).find((x) => x.email === want)) || (eps || []).find((x) => x.is_main);
    if (e) credit = { text: creditLine(e), verified: e.verified, photo: e.photo_url, profile: { display_name: e.display_name, full_name: e.full_name, roles: e.roles, credit: e.credit, photo_url: e.photo_url, bio: e.bio, instagram: e.instagram || null, verified: e.verified } };
  } catch {}
  return json({
    credit,
    kind: song ? 'song' : 'project',
    downloads: project.settings?.share_downloads || 'off',
    approve: project.settings?.share_approve !== false,
    showVersions: project.settings?.share_versions !== false,
    project: { title: project.title, artist: project.artist, type: project.type, release: project.release, seed: project.seed, cover: pcover },
    artist: artist || null,
    songs: list,
  });
}

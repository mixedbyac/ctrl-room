import { limit } from '@/lib/ratelimit';
import { admin, userFrom, canSee, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));
const pickVersion = (s, vs) => vs.find((v) => v.id === s.approved_version) || vs.find((v) => v.id === s.active_version) || vs.filter((v) => !isDemo(v)).at(-1) || vs[vs.length - 1];
const safe = (s) => String(s || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim();
const ext = (v) => (v.file_name || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || '';

// Download from a share link, if the engineer allowed it: settings.share_downloads = 'anyone' | 'team' (default off).
// body: { t, songId? }  (no songId = every song on the link). Returns [{ name, url, download }].
export async function POST(req) {
  const slow = limit(req, 'share-dl', 60, 600000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  const t = String(b?.t || '');
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
  const mode = project.settings?.share_downloads || 'off';
  if (mode === 'off') return fail('Downloads are locked on this link. Ask your engineer to turn them on.', 403);
  if (mode === 'team') {
    const user = await userFrom(req);
    if (!user || !(await canSee(user, project.id))) return fail('Only the artist’s team can download. Sign in to CTRL ROOM with your team email, then try again.', 401);
  }
  const { data: lockInv } = await db.from('invoices').select('id').eq('project_id', project.id).eq('lock', true).eq('status', 'unpaid').limit(1).then((r) => r, () => ({ data: null }));
  if (lockInv?.length) return fail('Downloads unlock once the invoice is paid.', 403);

  const pick = b.songId ? (songs || []).filter((s) => s.id === b.songId) : songs || [];
  const ids = pick.map((s) => s.id);
  const { data: allV } = ids.length ? await db.from('versions').select('*').in('song_id', ids).order('created_at') : { data: [] };
  const files = [], seen = {};
  for (const s of pick) {
    const vs = (allV || []).filter((v) => v.song_id === s.id);
    if (!vs.length) continue;
    const v = pickVersion(s, vs);
    let name = `${safe(s.title)}${ext(v)}`;
    const k = name.toLowerCase(); seen[k] = (seen[k] || 0) + 1;
    if (seen[k] > 1) name = name.replace(/(\.[a-z0-9]+)?$/i, ` (${seen[k]})$1`);
    const [{ data: u }, { data: d }] = await Promise.all([
      db.storage.from('mixes').createSignedUrl(v.storage_path, 900),
      db.storage.from('mixes').createSignedUrl(v.storage_path, 900, { download: name }),
    ]);
    if (u?.signedUrl) files.push({ name, url: u.signedUrl, download: d?.signedUrl || u.signedUrl });
  }
  if (!files.length) return fail('Nothing to download yet.', 404);
  return json({ files, zipName: `${safe(project.artist ? `${project.artist} - ${project.title}` : project.title)}.zip` });
}

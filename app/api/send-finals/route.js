import { admin, engineerFrom, json, fail } from '@/lib/server';
import { emailFinals, alertEngineers } from '@/lib/invite';

export const runtime = 'nodejs';
export const maxDuration = 30;

const safe = (s) => String(s || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim();
const ext = (v) => (v.file_name || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || '';

// Engineer: email the artist's team their approved file(s), with direct download buttons (links last 14 days).
// body: { projectId, songIds?: [] }  (no songIds = every approved song in the project)
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: project } = await db.from('projects').select('*').eq('id', b.projectId).maybeSingle();
  if (!project) return fail('Unknown project.', 404);
  let q = db.from('songs').select('id, title, status, approved_version, active_version, position').eq('project_id', project.id).eq('status', 'approved').order('position');
  if (Array.isArray(b.songIds) && b.songIds.length) q = q.in('id', b.songIds);
  const { data: songs } = await q;
  if (!songs?.length) return fail('Nothing approved yet.');
  const files = [];
  for (const s of songs) {
    const vid = s.approved_version || s.active_version;
    const { data: v } = vid ? await db.from('versions').select('id, label, storage_path, file_name, file_format, sample_rate, bit_depth').eq('id', vid).maybeSingle() : { data: null };
    if (!v?.storage_path) continue;
    const name = `${safe(s.title)}${ext(v)}`;
    const { data: u } = await db.storage.from('mixes').createSignedUrl(v.storage_path, 14 * 86400, { download: name });
    if (u?.signedUrl) files.push({ title: s.title, label: v.label, url: u.signedUrl, name, format: [v.file_format, v.bit_depth ? `${v.bit_depth}-bit` : '', v.sample_rate ? `${(v.sample_rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : ''].filter(Boolean).join(' · ') });
  }
  if (!files.length) return fail('Couldn’t find the approved files.');
  const r = await emailFinals(db, { project, files, from: user.email, who: user.user_metadata?.display_name || user.user_metadata?.name || 'Your engineer' });
  if (!r.sent) return fail(r.reason || 'The email didn’t go out.', 502);
  for (const s of songs) await db.from('updates').insert({ song_id: s.id, body: 'Sent the final file to the artist.' }).then(() => {}, () => {});
  // confirmation for you (email + phone, Settings › Notifications › Files sent)
  const what = files.length === 1 ? `${files[0].title} (${files[0].label})` : `${files.length} files from ${project.title}`;
  await alertEngineers(db, { kind: 'sent', subject: `Sent ${what} to ${project.artist || 'the artist'}`,
    text: `${what} went to ${r.to.join(', ')}. They got a download button for each file (good for 14 days).`, link: `/p/${project.id}`, linkLabel: 'Open the project' }).catch(() => {});
  return json({ ok: true, sent: r.sent, files: files.length });
}

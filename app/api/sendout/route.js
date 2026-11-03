import { admin, engineerFrom, json, fail } from '@/lib/server';
import { emailFinals, alertEngineers } from '@/lib/invite';

export const runtime = 'nodejs';
export const maxDuration = 60;

const safe = (s) => String(s || 'file').replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
const fmt = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

// Engineer → artist: send any files (stems, instrumentals, sessions…) to a project's artist team, with download buttons.
// { step: 'start', projectId, files: [{ name, size }] }  → upload slots
// { step: 'done', projectId, files: [{ path, name, size }], message? } → emails the team (links last 14 days)
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: project } = await db.from('projects').select('*').eq('id', b.projectId).maybeSingle();
  if (!project) return fail('Pick a project.', 404);
  const list = (Array.isArray(b.files) ? b.files : []).slice(0, 50);
  if (!list.length) return fail('Add at least one file.');
  if (b.step === 'start') {
    const stamp = Date.now();
    const slots = [];
    for (const [i, f] of list.entries()) {
      const path = `${project.id}/outgoing/${stamp}-${i}-${safe(f.name)}`;
      const { data, error } = await db.storage.from('mixes').createSignedUploadUrl(path);
      if (error) return fail(error.message, 500);
      slots.push({ path, token: data.token, name: f.name });
    }
    return json({ slots });
  }
  if (b.step === 'done') {
    const files = [];
    for (const f of list) {
      if (!String(f.path || '').startsWith(`${project.id}/outgoing/`)) continue;
      const { data: u } = await db.storage.from('mixes').createSignedUrl(f.path, 14 * 86400, { download: f.name });
      if (u?.signedUrl) files.push({ title: f.name, label: fmt(Number(f.size) || 0), url: u.signedUrl, name: f.name, format: '' });
    }
    if (!files.length) return fail('The files didn’t finish uploading. Try again.');
    const who = user.user_metadata?.display_name || user.user_metadata?.name || 'Your engineer';
    const r = await emailFinals(db, { project, files, from: user.email, who, kind: 'files', message: String(b.message || '').slice(0, 1000) });
    if (!r.sent) return fail(r.reason || 'The email didn’t go out.', 502);
    const { data: first } = await db.from('songs').select('id').eq('project_id', project.id).order('position').limit(1).maybeSingle();
    if (first) await db.from('updates').insert({ song_id: first.id, body: `Sent ${files.length} file${files.length > 1 ? 's' : ''} to the artist: ${files.map((f) => f.name).slice(0, 4).join(', ')}${files.length > 4 ? '…' : ''}.` }).then(() => {}, () => {});
    await alertEngineers(db, { kind: 'sent', subject: `Sent ${files.length} file${files.length > 1 ? 's' : ''} to ${project.artist || 'the artist'}`,
      text: `${files.map((f) => f.name).join(', ')} went to ${r.to.join(', ')} (download links good for 14 days).`, link: `/p/${project.id}`, linkLabel: 'Open the project' }).catch(() => {});
    return json({ ok: true, sent: r.sent, files: files.length });
  }
  return fail('Unknown step.');
}

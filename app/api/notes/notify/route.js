import { admin, engineerFrom, json, fail } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import { sendEmail, prefsFor, wantsEmail } from '@/lib/invite';
import { pushTo } from '@/lib/push';
import { mmss } from '@/lib/format';

export const runtime = 'nodejs';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The engineer left a note or replied to one: email the artist's side.
// A reply goes to whoever wrote the note (or the whole artist team if it came from a share link); a new note goes to the team.
// body: { noteId }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: note } = await db.from('notes').select('id, song_id, parent_id, body, t, author_name').eq('id', b.noteId).maybeSingle();
  if (!note) return fail('Unknown note.', 404);
  const { data: parent } = note.parent_id ? await db.from('notes').select('body, t, author_email, author_name, from_client').eq('id', note.parent_id).maybeSingle() : { data: null };
  const { data: song } = await db.from('songs').select('id, title, project_id, projects(title, artist, client_email)').eq('id', note.song_id).single();
  const project = song?.projects;

  const { data: es } = await db.from('app_config').select('value').like('key', 'engineer_email%');
  const engs = new Set([process.env.ENGINEER_EMAIL, ...(es || []).map((r) => r.value)].filter(Boolean).map((e) => e.toLowerCase()));
  let to = [];
  if (parent?.author_email && !engs.has(parent.author_email.toLowerCase())) to = [parent.author_email.toLowerCase()];
  else {
    if (project?.client_email) to.push(project.client_email.toLowerCase());
    if (project?.artist) { const { data: ms } = await db.from('artist_members').select('email').ilike('artist', project.artist); (ms || []).forEach((m) => m.email && to.push(m.email.toLowerCase())); }
  }
  to = [...new Set(to)].filter((e) => !engs.has(e));
  if (!to.length) return json({ sent: 0, reason: 'No email on this project or its team yet.' });

  const who = user.user_metadata?.display_name || user.user_metadata?.name || 'Your engineer';
  const link = `${SITE_URL}/s/${song.id}?from=email#notes`;
  const at = (x) => (x?.t != null ? ` at ${mmss(x.t)}` : '');
  const quote = parent ? `<div style="border-left:3px solid #3a3a40;padding:4px 0 4px 12px;margin:0 0 14px;color:#8a8a92;font-size:14px;line-height:1.5">You${at(parent)}: “${esc(parent.body)}”</div>` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5"><div style="max-width:520px;margin:0 auto;padding:36px 24px">
    <img src="${SITE_URL}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:24px">
    <p style="margin:0 0 6px;font-size:13px;color:#8a8a92">${esc(project?.artist || '')}${project?.title ? ` · ${esc(project.title)}` : ''}</p>
    <h1 style="font-size:22px;line-height:1.2;margin:0 0 16px">${esc(who)} ${parent ? 'replied to your note' : 'left a note'} on ${esc(song.title)}</h1>
    ${quote}<p style="font-size:16px;line-height:1.55;color:#f4f4f5;margin:0 0 26px;background:#1b1b1e;border-radius:12px;padding:14px 16px">${esc(note.body)}${!parent && note.t != null ? `<br><span style="color:#8a8a92;font-size:13px">at ${mmss(note.t)}</span>` : ''}</p>
    <a href="${link}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">Reply in CTRL ROOM</a>
    <p style="font-size:12px;color:#5e5e66;margin:36px 0 0">Powered by ARTHOUSE · <a href="https://art-house.us" style="color:#5e5e66">art-house.us</a></p></div></body></html>`;
  const prefs = await prefsFor(db, to).catch(() => ({}));
  let sent = 0;
  for (const e of to) {
    if (!wantsEmail(prefs, e, 'notes') && !parent) continue; // a direct reply always goes; new notes follow their email setting
    const r = await sendEmail({ to: e, replyTo: user.email, subject: `${who} ${parent ? 'replied to your note' : 'left a note'} · ${song.title}`, html,
      text: `${who} ${parent ? 'replied to your note' : 'left a note'} on ${song.title}: “${note.body}” Reply: ${link}` });
    if (r.sent) sent++;
  }
  await pushTo(to, { title: `${who} · ${song.title}`, body: note.body.slice(0, 140), url: `/s/${song.id}#notes` }, { kind: 'notes' });
  return json({ sent, to: to.length });
}

import { SITE_URL } from '@/lib/site';
import { sendText } from '@/lib/server';
import { prefOf } from '@/lib/notify';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Send an email through Resend (RESEND_API_KEY + EMAIL_FROM in Vercel). */
export async function sendEmail({ to, subject, html, text, replyTo, bcc, from: fromOverride }) {
  const key = process.env.RESEND_API_KEY, from = fromOverride || process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false, reason: 'not-set-up' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text,
      // replies go to you, and you get a copy of every email that goes out
      reply_to: process.env.EMAIL_REPLY_TO || replyTo || undefined,
      bcc: [process.env.EMAIL_BCC || bcc].filter((x) => x && x.toLowerCase() !== String(to).toLowerCase()) }),
  });
  if (r.ok) return { sent: true };
  const j = await r.json().catch(() => ({}));
  return { sent: false, reason: j.message || `Email service said ${r.status}` };
}

function inviteHtml({ link, artist, existing, site }) {
  const head = existing ? `You’ve been added to ${esc(artist)}` : `You’re invited to CTRL ROOM`;
  const body = existing
    ? `You can now listen to, comment on and approve ${esc(artist)}’s mixes in CTRL ROOM.`
    : `Your engineer set you up${artist ? ` with <b>${esc(artist)}</b>` : ''} in CTRL ROOM, where you listen to your mixes, leave notes right on the song, approve finals and send your files.`;
  return `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <img src="${site}/logo.png" alt="CTRL ROOM" width="120" style="display:block;margin-bottom:28px">
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px;text-transform:uppercase;letter-spacing:-.01em">${head}</h1>
    <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 26px">${body}</p>
    <a href="${link}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">${existing ? 'Open CTRL ROOM' : 'Create your account'}</a>
    <p style="font-size:13px;color:#8a8a92;margin:28px 0 0;line-height:1.5">The button works once and expires in 24 hours. If it’s expired, sign in at <a href="${site}/login" style="color:#c9c9cf">${site.replace(/^https?:\/\//, '')}</a> with “Email me a sign-in link”.</p>
    <p style="font-size:12px;color:#5e5e66;margin:36px 0 0">Powered by ARTHOUSE · <a href="https://art-house.us" style="color:#5e5e66">art-house.us</a></p>
  </div></body></html>`;
}

/**
 * Invite one person: make a sign-up link (or a sign-in link if they already have an account) and email it ourselves,
 * so it never depends on Supabase's built-in mailer (which only emails your own Supabase team).
 * Returns { status: 'invited'|'existing'|'link', link, user, sent, reason, texted }
 */
export async function invitePerson(db, { email, origin, artist, invitedBy, phone }) {
  let gen = await db.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: `${origin}/welcome`, data: { artist, invited_by: invitedBy } } });
  let existing = false;
  if (gen.error && /already|registered|exists/i.test(gen.error.message)) {
    existing = true;
    gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${origin}/` } });
  }
  if (gen.error) return { status: 'link', link: `${origin}/signup?email=${encodeURIComponent(email)}&artist=${encodeURIComponent(artist || '')}`, reason: gen.error.message };
  const link = gen.data?.properties?.action_link;
  const user = gen.data?.user || null;
  const mail = await sendEmail({
    to: email, replyTo: invitedBy || undefined, bcc: invitedBy || undefined,
    subject: existing ? `You’ve been added to ${artist} on CTRL ROOM` : `You’re invited to CTRL ROOM${artist ? ` · ${artist}` : ''}`,
    html: inviteHtml({ link, artist, existing, site: origin }),
    text: `${existing ? `You’ve been added to ${artist} on CTRL ROOM.` : `You’re invited to CTRL ROOM${artist ? ` for ${artist}` : ''}.`} ${existing ? 'Open it' : 'Create your account'} here: ${link}`,
  });
  let sent = mail.sent, reason = mail.reason;
  // no email service set up yet: fall back to Supabase's own invite email (only reaches people on your Supabase team)
  if (!sent && reason === 'not-set-up' && !existing) {
    const r = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/welcome`, data: { artist, invited_by: invitedBy } });
    if (!r.error) { sent = true; reason = 'supabase'; }
  }
  let texted = false;
  if (phone) texted = (await sendText(phone, `${artist ? `${artist}: ` : ''}you’re invited to CTRL ROOM to hear your mixes. ${existing ? 'Open' : 'Make your account'}: ${link}`)).sent;
  return { status: existing ? 'existing' : 'invited', link, user, sent, reason, texted };
}

/** Email every engineer (main + added) that someone joined CTRL ROOM. Best effort, never throws. */
export async function notifyEngineers(db, { name, email, artist, how, origin }) {
  try {
    const { data } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
    const to = [...new Set([process.env.ENGINEER_EMAIL, ...(data || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:')).map((r) => r.value)].filter(Boolean).map((e) => e.toLowerCase()))];
    const who = name ? `${name} (${email})` : email;
    const site = origin || SITE_URL;
    const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
      <div style="max-width:520px;margin:0 auto;padding:36px 24px">
        <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:22px">
        <h1 style="font-size:22px;margin:0 0 12px;text-transform:uppercase">New sign-up</h1>
        <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 6px"><b style="color:#fff">${esc(who)}</b> ${how === 'invite' ? 'accepted your invite and joined' : 'just made an account on'} CTRL ROOM${artist ? ` for <b style="color:#fff">${esc(artist)}</b>` : ''}.</p>
        <p style="font-size:14px;color:#8a8a92;margin:0 0 24px">${how === 'invite' ? 'They’re on the artist’s team, so they can open its projects now.' : 'Their projects unlock once their email is confirmed, or you tap Verify on the artist’s Team list.'}</p>
        <a href="${site}/artists${artist ? `?a=${encodeURIComponent(artist)}` : ''}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px">Open in CTRL ROOM</a>
      </div></body></html>`;
    const sp = await prefsFor(db, to).catch(() => ({}));
    for (const e of to.filter((x) => wantsEmail(sp, x, 'signups'))) await sendEmail({ to: e, subject: `New sign-up: ${name || email}${artist ? ` · ${artist}` : ''}`, html, text: `${who} ${how === 'invite' ? 'accepted your invite' : 'signed up'}${artist ? ` for ${artist}` : ''} on CTRL ROOM.` });
    if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${who} ${how === 'invite' ? 'joined from your invite' : 'signed up'}${artist ? ` (${artist})` : ''}.`);
  } catch {}
}

/** “Your files were sent” receipt for someone who sent files through the Portal (sendfileshere.com). */
export async function portalReceipt(db, { up, project, songs, total, bytes }) {
  if (!up?.email || !total) return { sent: false };
  const { data: eng } = await db.from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  const engineer = process.env.ENGINEER_EMAIL || eng?.value || undefined;
  const site = SITE_URL;
  const portal = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://sendfileshere.com';
  const first = String(up.name || '').split(/\s+/)[0] || 'there';
  const size = bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  const rows = songs.filter((s) => s.files).map((s) => `<tr><td style="padding:10px 0;border-top:1px solid #26262b;color:#f4f4f5;font-weight:600">${esc(s.title)}</td><td style="padding:10px 0;border-top:1px solid #26262b;color:#8a8a92;text-align:right">${s.files} file${s.files > 1 ? 's' : ''}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:26px">
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 12px;text-transform:uppercase">Files received ✓</h1>
    <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 22px">Hey ${esc(first)}, your ${total} file${total > 1 ? 's' : ''} (${size}) for <b style="color:#fff">${esc(project?.title || up.artist || 'your project')}</b> made it to the CTRL ROOM. We’ll take it from here and let you know when your mix is ready.</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 26px">${rows}</table>
    ${up.message ? `<p style="font-size:14px;color:#8a8a92;margin:0 0 24px">Your note: “${esc(up.message)}”</p>` : ''}
    <a href="${site}/login" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">Open CTRL ROOM</a>
    <p style="font-size:13px;color:#8a8a92;margin:28px 0 0;line-height:1.5">More files? Send them anytime at <a href="${portal}" style="color:#c9c9cf">${portal.replace(/^https?:\/\//, '')}</a>. Just reply to this email if you have questions.</p>
    <p style="font-size:12px;color:#5e5e66;margin:36px 0 0">Powered by ARTHOUSE · <a href="https://art-house.us" style="color:#5e5e66">art-house.us</a></p>
  </div></body></html>`;
  return sendEmail({
    to: up.email, from: process.env.PORTAL_EMAIL_FROM || undefined, replyTo: engineer,
    subject: `Files received · ${project?.title || up.artist || 'CTRL ROOM'}`,
    html, text: `Hey ${first}, your ${total} file${total > 1 ? 's' : ''} (${size}) for ${project?.title || up.artist} made it to the CTRL ROOM. We’ll let you know when your mix is ready. Reply to this email with any questions.`,
  });
}

const shell = (site, inner) => `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
  <div style="max-width:520px;margin:0 auto;padding:36px 24px">
    <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:24px">${inner}
    <p style="font-size:12px;color:#5e5e66;margin:36px 0 0">Powered by ARTHOUSE · <a href="https://art-house.us" style="color:#5e5e66">art-house.us</a></p>
  </div></body></html>`;
const button = (href, label) => `<a href="${href}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">${esc(label)}</a>`;

async function engineerEmails(db) {
  const { data } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
  return [...new Set([process.env.ENGINEER_EMAIL, ...(data || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:')).map((r) => r.value)].filter(Boolean).map((e) => e.toLowerCase()))];
}

/** A short alert to every engineer by email (and by text too if ENGINEER_PHONE + Twilio are set). */
export async function alertEngineers(db, { subject, text, link, linkLabel = 'Open CTRL ROOM', kind = null }) {
  try {
    const site = SITE_URL;
    const html = shell(site, `<h1 style="font-size:21px;line-height:1.2;margin:0 0 12px">${esc(subject)}</h1>
      <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 24px">${esc(text)}</p>${link ? button(link.startsWith('http') ? link : site + link, linkLabel) : ''}`);
    const list = await engineerEmails(db);
    const prefs = kind ? await prefsFor(db, list).catch(() => ({})) : {};
    for (const e of list) { if (kind && !wantsEmail(prefs, e, kind)) continue; await sendEmail({ to: e, subject: `CTRL ROOM: ${subject}`, html, text: `${text}${link ? ` ${link.startsWith('http') ? link : site + link}` : ''}` }); }
    if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${text}`).catch(() => {});
  } catch {}
}

/** An update to the artist's people (project contact + their team) about a song, by email. Falls back to a text if email isn't set up. */
export async function emailClient(db, { song, project, body, origin }) {
  const site = SITE_URL;
  const to = new Set();
  if (project?.client_email) to.add(project.client_email.toLowerCase());
  if (project?.artist) {
    const { data: ms } = await db.from('artist_members').select('email, artist').ilike('artist', project.artist);
    (ms || []).forEach((m) => m.email && to.add(m.email.toLowerCase()));
  }
  const engs = new Set(await engineerEmails(db));
  const list = [...to].filter((e) => !engs.has(e));
  const { data: eng } = await db.from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  const replyTo = process.env.ENGINEER_EMAIL || eng?.value || undefined;
  const link = `${site}/s/${song.id}?from=email`;
  const html = shell(site, `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a92">${esc(project?.title || '')}${project?.artist ? ` · ${esc(project.artist)}` : ''}</p>
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px">${esc(song.title)}</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 26px">${esc(body)}</p>${button(link, 'Listen in CTRL ROOM')}
    <p style="font-size:13px;color:#8a8a92;margin:26px 0 0">Reply to this email to reach your engineer.</p>`);
  let sent = 0, reason = '';
  const prefs = await prefsFor(db, list).catch(() => ({}));
  for (const e of list) {
    if (!wantsEmail(prefs, e, 'mixes')) continue;
    const r = await sendEmail({ to: e, subject: `${song.title}: ${body.length > 60 ? body.slice(0, 57) + '…' : body}`, html, text: `${song.title}: ${body} Listen: ${link}`, replyTo });
    if (r.sent) sent++; else reason = r.reason;
  }
  if (!sent && project?.phone && (reason === 'not-set-up' || !list.length)) {
    const t = await sendText(project.phone, `${song.title}: ${body} Listen: ${site}/s/${song.id}?from=text`);
    return { sent: t.sent, via: 'text', reason: t.reason };
  }
  return { sent: sent > 0, via: 'email', count: sent, reason: sent ? '' : !list.length ? 'No email on this project or its team yet.' : reason === 'not-set-up' ? 'Email isn’t set up yet.' : reason };
}

/** email -> notification settings, for the people we're about to email (reads their accounts once). */
export async function prefsFor(db, emails) {
  const want = new Set((emails || []).map((e) => String(e).toLowerCase()));
  const out = {};
  if (!want.size) return out;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    (data.users || []).forEach((u) => { const e = (u.email || '').toLowerCase(); if (want.has(e)) out[e] = u.user_metadata?.notify || {}; });
    if ((data.users || []).length < 200 || Object.keys(out).length === want.size) break;
  }
  return out;
}
export const wantsEmail = (prefs, email, kind) => prefOf(prefs[String(email).toLowerCase()], kind, 'email');

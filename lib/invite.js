import { PORTAL_URL } from '@/lib/site';
import { SITE_URL } from '@/lib/site';
import { sendText, getConfig, setConfig } from '@/lib/server';
import { prefOf } from '@/lib/notify';
import { pushTo } from '@/lib/push';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Keep the last 25 emails (to, subject, sent or why not) so Settings › Studio can show what went out. */
async function logEmail(entry) {
  try {
    const cur = JSON.parse((await getConfig('email_log')) || '[]');
    cur.unshift({ ...entry, at: new Date().toISOString() });
    await setConfig('email_log', JSON.stringify(cur.slice(0, 25)));
  } catch {}
}

async function resend(key, payload) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: e.message }) }));
  if (r.ok) return { sent: true };
  const j = await r.json().catch(() => ({}));
  return { sent: false, reason: j.message || `Email service said ${r.status}` };
}

/** Send an email through Resend (RESEND_API_KEY + EMAIL_FROM in Vercel). */
export async function sendEmail({ to, subject, html, text, replyTo, bcc, from: fromOverride, noCopy = false }) {
  const key = process.env.RESEND_API_KEY, main = process.env.EMAIL_FROM, from = fromOverride || main;
  if (!key || !from) { await logEmail({ to, subject, sent: false, reason: 'Email isn’t set up (RESEND_API_KEY / EMAIL_FROM).' }); return { sent: false, reason: 'not-set-up' }; }
  const payload = { from, to: [to], subject, html, text,
    // replies go to you, and you get a copy of every email that goes out
    reply_to: process.env.EMAIL_REPLY_TO || replyTo || undefined,
    bcc: noCopy ? [] : [process.env.EMAIL_BCC || bcc].filter((x) => x && x.toLowerCase() !== String(to).toLowerCase()) };
  let r = await resend(key, payload);
  // a second sender (like the Portal's) that isn't verified yet: fall back to the main one so it still goes out
  if (!r.sent && fromOverride && main && fromOverride !== main && /domain|verif|not allowed|from/i.test(r.reason || '')) {
    r = await resend(key, { ...payload, from: main });
    if (r.sent) r.note = `sent from ${main} (the other sender isn’t verified)`;
  }
  await logEmail({ to, subject, sent: r.sent, reason: r.sent ? (r.note || '') : r.reason });
  return r;
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
export async function notifyEngineers(db, { name, email, artist, title, how, origin }) {
  try {
    const { data } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
    const to = [...new Set([process.env.ENGINEER_EMAIL, ...(data || []).filter((r) => r.key === 'engineer_email' || r.key.startsWith('engineer_email:')).map((r) => r.value)].filter(Boolean).map((e) => e.toLowerCase()))];
    const who = (name ? `${name} (${email})` : email) + (title ? ` · ${title}` : '');
    const site = origin || SITE_URL;
    const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
      <div style="max-width:520px;margin:0 auto;padding:36px 24px">
        <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:22px">
        <h1 style="font-size:22px;margin:0 0 12px;text-transform:uppercase">New sign-up</h1>
        <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 6px"><b style="color:#fff">${esc(who)}</b> ${how === 'invite' ? 'accepted your invite and joined' : 'just made an account on'} CTRL ROOM${artist ? ` for <b style="color:#fff">${esc(artist)}</b>` : ''}.</p>
        <p style="font-size:14px;color:#8a8a92;margin:0 0 24px">${how === 'invite' ? 'They’re on the artist’s team, so they can open its projects now.' : 'Their projects unlock once their email is confirmed, or you tap Verify on the artist’s Team list.'}</p>
        <a href="${site}/people" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px">Open in CTRL ROOM</a>
      </div></body></html>`;
    const sp = await prefsFor(db, to).catch(() => ({}));
    for (const e of to.filter((x) => !wantsEmail(sp, x, 'signups'))) await logEmail({ to: e, subject: 'New sign-up', sent: false, reason: 'Skipped: sign-up emails are off in Settings › Notifications.' });
    if (!to.length) await logEmail({ to: '(no engineers)', subject: 'New sign-up', sent: false, reason: 'No engineer email is saved.' });
    await pushTo(to, { title: 'New sign-up', body: `${who} ${how === 'invite' ? 'accepted your invite' : 'signed up'}${artist ? ` for ${artist}` : ''}.`, url: '/people' }, { kind: 'signups' });
    for (const e of to.filter((x) => wantsEmail(sp, x, 'signups'))) await sendEmail({ to: e, subject: `New sign-up: ${name || email}${artist ? ` · ${artist}` : ''}`, html, text: `${who} ${how === 'invite' ? 'accepted your invite' : 'signed up'}${artist ? ` for ${artist}` : ''} on CTRL ROOM.` });
    if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${who} ${how === 'invite' ? 'joined from your invite' : 'signed up'}${artist ? ` (${artist})` : ''}.`);
  } catch (e) { await logEmail({ to: '(engineers)', subject: 'New sign-up', sent: false, reason: e.message }); }
}

/** “Your files were sent” receipt for someone who sent files through the Portal (sendfileshere.com). */
export async function portalReceipt(db, { up, project, songs, total, bytes }) {
  if (!up?.email || !total) return { sent: false };
  const { data: eng } = await db.from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  const engineer = process.env.ENGINEER_EMAIL || eng?.value || undefined;
  const site = SITE_URL;
  const portal = PORTAL_URL;
  const first = String(up.name || '').split(/\s+/)[0] || 'there';
  const hasAcct = await hasAccount(db, up.email).catch(() => true);
  const size = bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  const rows = songs.filter((s) => s.files).map((s) => `<tr><td style="padding:10px 0;border-top:1px solid #26262b;color:#f4f4f5;font-weight:600">${esc(s.title)}</td><td style="padding:10px 0;border-top:1px solid #26262b;color:#8a8a92;text-align:right">${s.files} file${s.files > 1 ? 's' : ''}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:26px">
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 12px;text-transform:uppercase">Files received ✓</h1>
    <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 22px">Hey ${esc(first)}, your ${total} file${total > 1 ? 's' : ''} (${size}) for <b style="color:#fff">${esc(project?.title || up.artist || 'your project')}</b> made it to the CTRL ROOM. We’ll take it from here and let you know when your mix is ready.</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 26px">${rows}</table>
    ${up.message ? `<p style="font-size:14px;color:#8a8a92;margin:0 0 24px">Your note: “${esc(up.message)}”</p>` : ''}
    ${hasAcct ? `<a href="${site}/login" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">Open CTRL ROOM</a>`
      : `<p style="font-size:15px;line-height:1.5;color:#c9c9cf;margin:0 0 16px"><b style="color:#fff">Make your free account</b> to hear your mixes as they land, leave notes right on the song and approve. It takes a minute.</p>
    <a href="${signupLink({ email: up.email, name: up.name, artist: up.artist, title: await getConfig(`sender_title:${String(up.email).toLowerCase()}`).catch(() => '') })}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">Make your account</a>`}
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
    if (!list.length) { await logEmail({ to: '(no engineers)', subject, sent: false, reason: 'No engineer email is saved, so nobody got this.' }); return { sent: false, reason: 'no engineers' }; }
    const out = [];
    for (const e of list) {
      if (kind && !wantsEmail(prefs, e, kind)) { await logEmail({ to: e, subject, sent: false, reason: 'Skipped: this email alert is off in Settings › Notifications.' }); out.push({ to: e, sent: false }); continue; }
      out.push({ to: e, ...(await sendEmail({ to: e, subject: `CTRL ROOM: ${subject}`, html, text: `${text}${link ? ` ${link.startsWith('http') ? link : site + link}` : ''}` })) });
    }
    await pushTo(list, { title: subject, body: text, url: link && !link.startsWith('http') ? link : '/' }, { kind });
    if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${text}`).catch(() => {});
    return { sent: out.some((x) => x.sent), list: out };
  } catch (e) { await logEmail({ to: '(engineers)', subject, sent: false, reason: e.message }); return { sent: false, reason: e.message }; }
}

/** An update to the artist's people (project contact + their team) about a song, by email. Falls back to a text if email isn't set up. */
export async function emailClient(db, { song, project, body, origin, linkPath }) {
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
  const link = `${site}${linkPath || `/s/${song.id}`}?from=email`;
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
  await pushTo(list, { title: song.title, body, url: linkPath || `/s/${song.id}` }, { kind: 'mixes' });
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


/** Every account email (lowercase). Pages through Supabase's user list. */
export async function accountEmails(db) {
  const set = new Map();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    (data.users || []).forEach((u) => u.email && set.set(u.email.toLowerCase(), u));
    if ((data.users || []).length < 200) break;
  }
  return set;
}
export async function hasAccount(db, email) { return (await accountEmails(db)).has(String(email || '').toLowerCase()); }

export const signupLink = ({ email, name, artist, title }) => `${SITE_URL}/signup?${new URLSearchParams(Object.fromEntries(Object.entries({ email, name, artist, title }).filter(([, v]) => v)))}`;

/** “Make your account, it’s a better experience” — for people who sent files or were added by email but never signed up. */
export async function signupNudge(db, { email, name, artist, reason = 'files' }) {
  const site = SITE_URL;
  const title = await getConfig(`sender_title:${String(email).toLowerCase()}`).catch(() => '');
  const first = String(name || '').split(/\s+/)[0];
  const lead = reason === 'files'
    ? `Thanks for sending your files${artist ? ` for <b style="color:#fff">${esc(artist)}</b>` : ''}.`
    : `You’re on ${artist ? `<b style="color:#fff">${esc(artist)}</b>’s` : 'the'} list in CTRL ROOM, but you don’t have an account yet.`;
  const html = shell(site, `<h1 style="font-size:22px;line-height:1.2;margin:0 0 12px;text-transform:uppercase">${first ? `Hey ${esc(first)}, ` : ''}one quick thing</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 12px">${lead} Make a free CTRL ROOM account so everything is in one place:</p>
    <ul style="font-size:15px;line-height:1.7;color:#c9c9cf;margin:0 0 22px;padding-left:20px"><li>Hear each mix the moment it’s ready</li><li>Leave notes right at the moment in the song</li><li>Approve, track progress and grab your files</li></ul>
    ${button(signupLink({ email, name, artist, title }), 'Make your account')}
    <p style="font-size:13px;color:#8a8a92;margin:22px 0 0">Takes a minute: your name, a password and what you do. Just reply if you have questions.</p>`);
  return sendEmail({ to: email, subject: `${artist ? `${artist}: ` : ''}make your CTRL ROOM account`, html,
    text: `${first ? `Hey ${first}, ` : ''}make a free CTRL ROOM account to hear your mixes as they land, leave notes and approve: ${signupLink({ email, name, artist, title })}` });
}

/** “Confirm your email” — sent right after sign-up (and again from the banner). */
export async function sendConfirmEmail(user, link) {
  const first = String(user.user_metadata?.name || '').split(/\s+/)[0];
  const html = shell(SITE_URL, `<h1 style="font-size:22px;line-height:1.2;margin:0 0 12px;text-transform:uppercase">Confirm your email</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 24px">${first ? `Hey ${esc(first)}, ` : ''}tap below so CTRL ROOM knows this email is really yours. Your projects unlock right after.</p>
    ${button(link, 'Confirm my email')}
    <p style="font-size:13px;color:#8a8a92;margin:22px 0 0">Didn’t make a CTRL ROOM account? Ignore this email. The link works for 7 days.</p>`);
  return sendEmail({ to: user.email, subject: 'Confirm your email for CTRL ROOM', html, text: `Confirm your email for CTRL ROOM: ${link}` });
}

/** “Your mixes are ready to download” — to the project contact and the artist's team, when the engineer turns downloads on. */
export async function emailDownloadsOn(db, { project, songs = [], from }) {
  const to = new Set();
  if (project?.client_email) to.add(project.client_email.toLowerCase());
  if (project?.artist) { const { data: ms } = await db.from('artist_members').select('email').ilike('artist', project.artist); (ms || []).forEach((m) => m.email && to.add(m.email.toLowerCase())); }
  const engs = new Set(await engineerEmails(db));
  const list = [...to].filter((e) => !engs.has(e));
  if (!list.length) return { sent: 0, reason: 'No email on this project or its team yet.' };
  const link = `${SITE_URL}/p/${project.id}?from=email`;
  const names = songs.map((s) => s.title).slice(0, 6);
  const html = shell(SITE_URL, `<p style="margin:0 0 6px;font-size:13px;color:#8a8a92">${esc(project.artist || '')}</p>
    <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">${esc(project.title)} is ready to download</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 ${names.length ? 14 : 24}px">Your approved mixes can be downloaded now. Open the project and tap the download button.</p>
    ${names.length ? `<p style="font-size:15px;line-height:1.7;color:#f4f4f5;margin:0 0 24px">${names.map((n) => `✓ ${esc(n)}`).join('<br>')}</p>` : ''}
    ${button(link, 'Download your mixes')}`);
  let sent = 0, reason = '';
  for (const e of list) { const r = await sendEmail({ to: e, replyTo: from || undefined, subject: `${project.title}: ready to download`, html, text: `${project.title} is ready to download: ${link}` }); if (r.sent) sent++; else reason = r.reason; }
  await pushTo(list, { title: `${project.title} is ready to download`, body: 'Your approved mixes can be downloaded now.', url: `/p/${project.id}` }, { kind: 'mixes' });
  return { sent, reason };
}

/** “Your final mix” — the approved file(s) with direct download buttons, to the project contact and the artist's team. */
export async function emailFinals(db, { project, files, from, who, kind = 'finals', message = '' }) {
  const to = new Set();
  if (project?.client_email) to.add(project.client_email.toLowerCase());
  if (project?.artist) { const { data: ms } = await db.from('artist_members').select('email').ilike('artist', project.artist); (ms || []).forEach((m) => m.email && to.add(m.email.toLowerCase())); }
  const engs = new Set(await engineerEmails(db));
  const list = [...to].filter((e) => !engs.has(e));
  if (!list.length) return { sent: 0, reason: 'No email on this project or its team yet. Add one in Client access.' };
  const one = files.length === 1;
  let sentTo = null;
  const rows = files.map((f) => `<tr><td style="padding:12px 0;border-top:1px solid #26262b"><b style="color:#f4f4f5;font-size:15px">${esc(f.title)}</b><br><span style="color:#8a8a92;font-size:12.5px">${esc(f.label)}${f.format ? ` · ${esc(f.format)}` : ''}</span></td>
    <td style="padding:12px 0;border-top:1px solid #26262b;text-align:right"><a href="${f.url}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:14px;text-decoration:none;padding:9px 16px;border-radius:10px">Download</a></td></tr>`).join('');
  const html = shell(SITE_URL, `<p style="margin:0 0 6px;font-size:13px;color:#8a8a92">${esc(project.artist || '')}${project.title ? ` · ${esc(project.title)}` : ''}</p>
    <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">${kind === 'files' ? `${esc(who)} sent you ${one ? 'a file' : `${files.length} files`}` : one ? 'Your final mix is ready' : 'Your final mixes are ready'}</h1>
    ${message ? `<p style="font-size:16px;line-height:1.55;color:#f4f4f5;margin:0 0 14px;background:#1b1b1e;border-radius:12px;padding:12px 14px">${esc(message)}</p>` : ''}
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 18px">${kind === 'files' ? `Download ${one ? 'it' : 'them'} below. The ${one ? 'link works' : 'links work'} for 14 days.` : `${esc(who)} sent ${one ? 'the approved file' : 'the approved files'}. Download ${one ? 'it' : 'them'} below. The ${one ? 'link works' : 'links work'} for 14 days, and you can always grab ${one ? 'it' : 'them'} again in CTRL ROOM.`}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">${rows}</table>
    ${button(`${SITE_URL}/p/${project.id}?from=email`, 'Open in CTRL ROOM')}`);
  let sent = 0, reason = '';
  for (const e of list) {
    const r = await sendEmail({ to: e, replyTo: from || undefined, subject: kind === 'files' ? `${who} sent you ${one ? files[0].title : `${files.length} files`} · ${project.title}` : `${one ? files[0].title : project.title}: final ${one ? 'mix' : 'mixes'}`, html,
      text: `${who} sent your final ${one ? 'mix' : 'mixes'}:\n${files.map((f) => `${f.title} (${f.label}): ${f.url}`).join('\n')}` });
    if (r.sent) { sent++; (sentTo ||= []).push(e); } else reason = r.reason;
  }
  await pushTo(list, { title: one ? `${files[0].title}: final mix` : `${project.title}: final mixes`, body: 'Ready to download.', url: `/p/${project.id}` }, { kind: 'mixes' });
  return { sent, reason, to: sentTo || [] };
}

/** “You're on <artist>'s team now” — existing accounts get a heads-up, new people get an invite to join. */
export async function teamAdded(db, { email, artist, role, by }) {
  const e = String(email).toLowerCase();
  const accts = await accountEmails(db).catch(() => new Map());
  if (!accts.has(e)) return invitePerson(db, { email: e, origin: SITE_URL, artist, invitedBy: by || undefined });
  const link = `${SITE_URL}/artists?a=${encodeURIComponent(artist)}`;
  const what = /^artist$/i.test(role || '') ? `as the artist` : role ? `as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}` : '';
  const html = shell(SITE_URL, `<h1 style="font-size:22px;line-height:1.2;margin:0 0 12px">You’re on ${esc(artist)}’s team</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 24px">You were added ${esc(what)} in CTRL ROOM. You can now hear ${esc(artist)}’s mixes, leave notes and follow every project.</p>
    ${button(link, `Open ${artist}`)}`);
  const r = await sendEmail({ to: e, replyTo: by || undefined, subject: `You’re on ${artist}’s team in CTRL ROOM`, html, text: `You were added to ${artist}’s team in CTRL ROOM: ${link}` });
  await pushTo([e], { title: `You’re on ${artist}’s team`, body: 'Open CTRL ROOM to see their projects.', url: `/artists?a=${encodeURIComponent(artist)}` });
  return { status: 'existing', ...r };
}

/** The 6-digit sign-in code (never copied to anyone else). */
export async function sendSigninCode(email, code) {
  const html = shell(SITE_URL, `<h1 style="font-size:22px;line-height:1.2;margin:0 0 12px;text-transform:uppercase">Your sign-in code</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 20px">Enter this code in CTRL ROOM to sign in.</p>
    <p style="font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:.22em;font-weight:700;margin:0 0 22px;color:#f5d547">${esc(code)}</p>
    <p style="font-size:13px;color:#8a8a92;margin:0">It works once, for the next hour. Didn’t try to sign in? Ignore this email.</p>`);
  return sendEmail({ to: email, subject: `${code} is your CTRL ROOM code`, html, text: `Your CTRL ROOM sign-in code: ${code}`, noCopy: true });
}

/** Ask the artist's team to send files: one email with the project's drop link. */
export async function emailFileRequest(db, { project, url, message }) {
  const to = new Set();
  if (project?.client_email) to.add(project.client_email.toLowerCase());
  if (project?.artist) {
    const { data: ms } = await db.from('artist_members').select('email').ilike('artist', project.artist);
    (ms || []).forEach((m) => m.email && to.add(m.email.toLowerCase()));
  }
  const engs = new Set(await engineerEmails(db));
  const list = [...to].filter((e) => !engs.has(e));
  if (!list.length) return { sent: false, count: 0, reason: 'No email on this project or its team yet.' };
  const { data: eng } = await db.from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  const replyTo = process.env.ENGINEER_EMAIL || eng?.value || undefined;
  const note = String(message || '').trim() || 'Send me the files for this one here. Drop them in and they go straight into the project.';
  const html = shell(SITE_URL, `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a92">${esc(project?.artist || '')}</p>
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px">Files for ${esc(project?.title || 'your project')}</h1>
    <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 26px">${esc(note)}</p>${button(url, 'Send files')}
    <p style="font-size:13px;color:#8a8a92;margin:26px 0 0">Stems, sessions, references: anything up to 5 GB. Reply to this email to reach your engineer.</p>`);
  let sent = 0, reason = '';
  for (const e of list) {
    const r = await sendEmail({ to: e, subject: `Send files for ${project?.title || 'your project'}`, html, text: `${note} Send files: ${url}`, replyTo });
    if (r.sent) sent++; else reason = r.reason;
  }
  return { sent: sent > 0, count: sent, reason };
}

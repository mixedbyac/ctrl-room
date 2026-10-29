import { sendText } from '@/lib/server';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Send an email through Resend (RESEND_API_KEY + EMAIL_FROM in Vercel). */
export async function sendEmail({ to, subject, html, text, replyTo, bcc }) {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
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
    const site = origin || process.env.NEXT_PUBLIC_SITE_URL || '';
    const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
      <div style="max-width:520px;margin:0 auto;padding:36px 24px">
        <img src="${site}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:22px">
        <h1 style="font-size:22px;margin:0 0 12px;text-transform:uppercase">New sign-up</h1>
        <p style="font-size:16px;line-height:1.5;color:#c9c9cf;margin:0 0 6px"><b style="color:#fff">${esc(who)}</b> ${how === 'invite' ? 'accepted your invite and joined' : 'just made an account on'} CTRL ROOM${artist ? ` for <b style="color:#fff">${esc(artist)}</b>` : ''}.</p>
        <p style="font-size:14px;color:#8a8a92;margin:0 0 24px">${how === 'invite' ? 'They’re on the artist’s team, so they can open its projects now.' : 'Their projects unlock once their email is confirmed, or you tap Verify on the artist’s Team list.'}</p>
        <a href="${site}/artists${artist ? `?a=${encodeURIComponent(artist)}` : ''}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px">Open in CTRL ROOM</a>
      </div></body></html>`;
    for (const e of to) await sendEmail({ to: e, subject: `New sign-up: ${name || email}${artist ? ` · ${artist}` : ''}`, html, text: `${who} ${how === 'invite' ? 'accepted your invite' : 'signed up'}${artist ? ` for ${artist}` : ''} on CTRL ROOM.` });
    if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${who} ${how === 'invite' ? 'joined from your invite' : 'signed up'}${artist ? ` (${artist})` : ''}.`);
  } catch {}
}

import { admin, json, fail, getConfig, setConfig } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import { accountEmails, signupNudge, sendEmail } from '@/lib/invite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY = 864e5;
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Daily (Vercel Cron, see vercel.json). One friendly reminder each, never more:
//  · sent files through the Portal a day or more ago but still has no account → “make your account”
//  · was invited but never set up their account → the invite again
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ua = req.headers.get('user-agent') || '';
  if (!(secret ? auth === `Bearer ${secret}` : /vercel-cron/i.test(ua))) return fail('Only the daily job can run this.', 401);
  const db = admin();
  const done = JSON.parse((await getConfig('signup_reminders')) || '{}'); // email -> date reminded
  const now = Date.now(), out = { senders: 0, invites: 0 };
  const accts = await accountEmails(db);
  const { data: engs } = await db.from('app_config').select('value').like('key', 'engineer_email%');
  const skip = new Set([(process.env.ENGINEER_EMAIL || '').toLowerCase(), ...(engs || []).map((r) => String(r.value).toLowerCase())]);

  // Portal senders without an account (sent 20 hours to 14 days ago)
  const { data: ups } = await db.from('uploads').select('email, name, artist, created_at').not('email', 'is', null)
    .lte('created_at', new Date(now - 20 * 36e5).toISOString()).gte('created_at', new Date(now - 14 * DAY).toISOString()).order('created_at', { ascending: false });
  const seen = new Set();
  for (const u of ups || []) {
    const e = String(u.email || '').toLowerCase();
    if (!e || seen.has(e) || accts.has(e) || skip.has(e) || done[e]) continue;
    seen.add(e);
    const r = await signupNudge(db, { email: e, name: u.name, artist: u.artist, reason: 'files' }).catch(() => ({ sent: false }));
    if (r.sent) { done[e] = new Date().toISOString().slice(0, 10); out.senders++; }
    await new Promise((res) => setTimeout(res, 550));
    if (out.senders >= 40) break;
  }

  // invited (an account exists) but never signed in, 1–14 days later
  for (const [e, u] of accts) {
    if (out.invites >= 30) break;
    if (u.last_sign_in_at || done[e] || skip.has(e)) continue;
    const age = now - new Date(u.created_at).getTime();
    if (age < DAY || age > 14 * DAY || !u.invited_at) continue;
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email: e, options: { redirectTo: `${SITE_URL}/welcome` } }).catch(() => null);
    const link = gen?.data?.properties?.action_link;
    if (!link) continue;
    const artist = u.user_metadata?.artist || '';
    const html = `<!doctype html><html><body style="margin:0;background:#0f0f10;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5"><div style="max-width:520px;margin:0 auto;padding:36px 24px">
      <img src="${SITE_URL}/logo.png" alt="CTRL ROOM" width="96" style="display:block;margin-bottom:24px">
      <h1 style="font-size:22px;margin:0 0 12px;text-transform:uppercase">Your invite is waiting</h1>
      <p style="font-size:16px;line-height:1.55;color:#c9c9cf;margin:0 0 24px">You were invited to CTRL ROOM${artist ? ` for <b style="color:#fff">${esc(artist)}</b>` : ''}. Set your name and a password to hear your mixes, leave notes and approve.</p>
      <a href="${link}" style="display:inline-block;background:#f5d547;color:#0f0f10;font-weight:700;font-size:16px;text-decoration:none;padding:14px 24px;border-radius:12px">Set up my account</a>
      <p style="font-size:12px;color:#5e5e66;margin:36px 0 0">Powered by ARTHOUSE · <a href="https://art-house.us" style="color:#5e5e66">art-house.us</a></p></div></body></html>`;
    const r = await sendEmail({ to: e, subject: `Reminder: your CTRL ROOM invite${artist ? ` · ${artist}` : ''}`, html, text: `You were invited to CTRL ROOM${artist ? ` for ${artist}` : ''}. Set up your account: ${link}` });
    if (r.sent) { done[e] = new Date().toISOString().slice(0, 10); out.invites++; }
    await new Promise((res) => setTimeout(res, 550));
  }
  await setConfig('signup_reminders', JSON.stringify(done));
  return json({ ok: true, ...out });
}

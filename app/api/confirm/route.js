import { limit } from '@/lib/ratelimit';
import { admin, userFrom, json, fail } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import { sendConfirmEmail } from '@/lib/invite';
import { confirmLink, confirmOk } from '@/lib/confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The “Confirm your email” link CTRL ROOM emails new accounts. Tapping it proves the email is theirs.
export async function GET(req) {
  const u = new URL(req.url).searchParams;
  const id = u.get('u'), exp = Number(u.get('x')), sig = u.get('s') || '';
  const bad = (why) => Response.redirect(`${SITE_URL}/?confirm=${why}`, 302);
  if (!id || !exp || exp < Date.now() / 1000) return bad('expired');
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(id);
  const user = data?.user;
  if (error || !user) return bad('expired');
  if (!confirmOk(user, exp, sig)) return bad('expired');
  await db.auth.admin.updateUserById(id, { email_confirm: true, app_metadata: { ...(user.app_metadata || {}), needs_verify: false, email_confirmed_by: 'link' } });
  return Response.redirect(`${SITE_URL}/?confirmed=1`, 302);
}

// Signed in: email me my confirmation link (again).
export async function POST(req) {
  const slow = limit(req, 'confirm-send', 5, 3600_000); if (slow) return slow;
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  if (!user.app_metadata?.needs_verify) return json({ ok: true, already: true });
  const r = await sendConfirmEmail(user, confirmLink(user));
  if (!r.sent) return fail(r.reason === 'not-set-up' ? 'Email isn’t set up yet. Ask your engineer to confirm you.' : `Couldn’t send it: ${r.reason}`, 502);
  return json({ ok: true, to: user.email });
}

import { limit } from '@/lib/ratelimit';
import { admin, json, fail } from '@/lib/server';
import { sendSigninCode } from '@/lib/invite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The email sign-in code, sent through our own email (Resend) instead of Supabase's mailer,
// which only allows a few emails an hour for the whole app. The code is Supabase's own, so verifyOtp works as usual.
export async function POST(req) {
  const slow = limit(req, 'signin-code', 8, 600000); if (slow) return slow;
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email.');
  const perEmail = limit(req, 'signin-code-email', 4, 600000, email); if (perEmail) return fail('A code was just sent. Check your email (and spam), or wait a few minutes.', 429);
  const db = admin();
  let { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error && /not found|no user|does not exist/i.test(error.message)) {
    // new email: make the account (unconfirmed until they enter the code), same as before
    const made = await db.auth.admin.createUser({ email, email_confirm: false });
    if (made.error && !/already/i.test(made.error.message)) return fail(made.error.message, 500);
    ({ data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email }));
  }
  if (error) return fail(error.message, 500);
  const code = data?.properties?.email_otp;
  if (!code) return fail('Couldn’t make a sign-in code.', 500);
  const r = await sendSigninCode(email, code);
  if (!r.sent) return fail(`The sign-in email didn’t go out (${r.reason || 'email error'}). Try again, or sign in with a password.`, 502);
  return json({ ok: true });
}

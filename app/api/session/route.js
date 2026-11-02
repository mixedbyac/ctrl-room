import { cookies } from 'next/headers';
import { admin, userFrom, jwtClaims, json, fail } from '@/lib/server';
import { limit } from '@/lib/ratelimit';
import { autoJoin } from '@/lib/autojoin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// “Stay signed in”: a backup of your sign-in kept in a secure cookie, so a phone that clears website storage
// (iPhone Safari does this after a week away) signs you right back in instead of showing the sign-in page.
const NAME = 'cr_keep';
const opts = { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/session', maxAge: 400 * 86400 };

async function refresh(token) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token }), signal: AbortSignal.timeout(8000),
  });
  return r.ok ? r.json() : null;
}

// no saved session in the browser: try the backup
export async function GET(req) {
  const slow = limit(req, 'session-restore', 30, 600_000); if (slow) return slow;
  const jar = cookies(), token = jar.get(NAME)?.value;
  if (!token) return json({ session: null });
  const s = await refresh(token).catch(() => null);
  if (!s?.access_token) { jar.set(NAME, '', { ...opts, maxAge: 0 }); return json({ session: null }); }
  jar.set(NAME, s.refresh_token, opts);
  return json({ session: { access_token: s.access_token, refresh_token: s.refresh_token } });
}

// { refresh_token } after every sign-in / token refresh, or { clear: true } when you sign out
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const jar = cookies();
  if (b.clear) { jar.set(NAME, '', { ...opts, maxAge: 0 }); return json({ ok: true }); }
  const user = await userFrom(req);
  if (!user || !b.refresh_token || String(b.refresh_token).length > 200) return fail('Sign in first.', 401);
  jar.set(NAME, String(b.refresh_token), opts);
  // confirmed accounts that sent files / are a project's contact: make sure they're on that artist with the right role
  if (!user.app_metadata?.needs_verify) await autoJoin(admin(), user);
  // a remembered device (two-step) stays remembered while you keep using it
  try {
    const sid = jwtClaims((req.headers.get('authorization') || '').slice(7))?.session_id;
    const { data: ts } = sid ? await admin().from('trusted_sessions').select('device_id').eq('session_id', sid).eq('user_id', user.id).maybeSingle() : { data: null };
    if (ts?.device_id) await admin().from('trusted_devices').update({ expires_at: new Date(Date.now() + 365 * 86400e3).toISOString(), last_used: new Date().toISOString() }).eq('id', ts.device_id).gt('expires_at', new Date().toISOString());
  } catch {}
  return json({ ok: true });
}

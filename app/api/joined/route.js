import { SITE_URL } from '@/lib/site';
import { admin, userFrom, json, fail } from '@/lib/server';
import { notifyEngineers } from '@/lib/invite';

export const runtime = 'nodejs';

// Called once when an invited person finishes setting up their account on /welcome: lets the engineer know.
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const db = admin();
  if (user.app_metadata?.joined_notified) return json({ ok: true });
  await db.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), joined_notified: true } });
  const origin = SITE_URL;
  await notifyEngineers(db, { name: user.user_metadata?.name, email: user.email, artist: user.user_metadata?.artist, how: 'invite', origin });
  return json({ ok: true });
}

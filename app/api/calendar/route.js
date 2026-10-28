import { userFrom, isEngineer, getConfig, setConfig, newToken, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

// Engineer only: the private calendar subscription link. body: { reset?: true }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user.email))) return fail('Only the engineer can do that.', 403);
  const b = await req.json().catch(() => ({}));
  let token = await getConfig('calendar_token');
  if (!token || b.reset) { token = newToken() + newToken() + newToken(); await setConfig('calendar_token', token); }
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const https = `${site}/api/calendar/${token}.ics`;
  return json({ https, webcal: https.replace(/^https?:/, 'webcal:') });
}

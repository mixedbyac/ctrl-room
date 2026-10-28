import { userFrom, isEngineer, getConfig, setConfig, newToken, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

// Engineer: get (or reset) the Zapier webhook link for marking invoices paid automatically.
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user.email))) return fail('Only the engineer can do that.', 403);
  const b = await req.json().catch(() => ({}));
  let key = await getConfig('invoice_hook_key');
  if (!key || b.reset) { key = newToken() + newToken() + newToken(); await setConfig('invoice_hook_key', key); }
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  return json({ url: `${site}/api/invoices/hook?key=${key}` });
}

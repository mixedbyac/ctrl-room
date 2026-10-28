import { userFrom, isEngineer, getConfig, setConfig, forgetDropboxToken, dropboxApi, dropboxRoot, json, fail, newToken } from '@/lib/server';

export const runtime = 'nodejs';

const origin = (req) => process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

// Engineer only. body: { action: 'status' | 'connect' | 'folders' | 'root' | 'disconnect', path?, root? }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user.email))) return fail('Only the engineer can set up Dropbox.', 403);
  const b = await req.json().catch(() => ({}));
  const hasKeys = !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
  const redirect = `${origin(req)}/api/dropbox/callback`;

  if (b.action === 'connect') {
    if (!hasKeys) return fail('Add DROPBOX_APP_KEY and DROPBOX_APP_SECRET in Vercel first.', 400);
    const state = newToken() + newToken();
    await setConfig('dropbox_state', `${state}.${Date.now()}`);
    const u = new URL('https://www.dropbox.com/oauth2/authorize');
    u.search = new URLSearchParams({ client_id: process.env.DROPBOX_APP_KEY, response_type: 'code', token_access_type: 'offline', redirect_uri: redirect, state }).toString();
    return json({ url: u.toString() });
  }
  if (b.action === 'disconnect') {
    await setConfig('dropbox_refresh_token', null); await setConfig('dropbox_account', null); forgetDropboxToken();
    return json({ ok: true });
  }
  if (b.action === 'root') {
    const root = '/' + String(b.root || '').split('/').map((s) => s.trim()).filter(Boolean).join('/');
    await setConfig('dropbox_root', root === '/' ? '' : root);
    return json({ root: await dropboxRoot() });
  }
  if (b.action === 'folders') {
    try {
      const path = b.path && b.path !== '/' ? b.path : '';
      const r = await dropboxApi('files/list_folder', { path, limit: 500 });
      const folders = (r.entries || []).filter((e) => e['.tag'] === 'folder').map((e) => ({ name: e.name, path: e.path_display })).sort((a, c) => a.name.localeCompare(c.name));
      return json({ path: path || '/', folders });
    } catch (e) { return fail(e.message, 500); }
  }
  // status
  const refresh = (await getConfig('dropbox_refresh_token')) || process.env.DROPBOX_REFRESH_TOKEN;
  let account = null;
  try { account = JSON.parse((await getConfig('dropbox_account')) || 'null'); } catch {}
  return json({ hasKeys, connected: !!refresh, account, root: await dropboxRoot(), redirect });
}

import { userFrom, isEngineer, getConfig, setConfig, forgetDropboxToken, forgetPathRoot, dropboxApi, dropboxRoot, json, fail, signState } from '@/lib/server';

export const runtime = 'nodejs';

const origin = (req) => process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

// Engineer only. body: { action: 'status' | 'connect' | 'folders' | 'root' | 'disconnect', path?, root? }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user))) return fail('Only the engineer can set up Dropbox.', 403);
  const b = await req.json().catch(() => ({}));
  const hasKeys = !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
  const redirect = `${origin(req)}/api/dropbox/callback`;

  if (b.action === 'connect') {
    if (!hasKeys) return fail('Add DROPBOX_APP_KEY and DROPBOX_APP_SECRET in Vercel first.', 400);
    const state = signState();
    const u = new URL('https://www.dropbox.com/oauth2/authorize');
    u.search = new URLSearchParams({ client_id: process.env.DROPBOX_APP_KEY, response_type: 'code', token_access_type: 'offline', redirect_uri: redirect, state, force_reapprove: 'true', force_reauthentication: 'true' }).toString(); // always ask which account (personal or business)
    return json({ url: u.toString() });
  }
  if (b.action === 'disconnect') {
    await setConfig('dropbox_refresh_token', null); await setConfig('dropbox_account', null); await setConfig('dropbox_path_root', null); forgetDropboxToken(); forgetPathRoot();
    return json({ ok: true });
  }
  if (b.action === 'root') {
    const root = '/' + String(b.root || '').replace(/\\/g, '/').replace(/^.*?dropbox(\.com\/home)?\//i, '').split('/').map((x) => x.trim()).filter(Boolean).join('/');
    const clean = root === '/' ? '' : root;
    if (clean && b.create) { try { await dropboxApi('files/create_folder_v2', { path: clean, autorename: false }); } catch (e) { if (!/conflict|already/i.test(e.message)) return fail(e.message, 500); } }
    const { error } = await setConfig('dropbox_root', clean);
    if (error) return fail(error.message, 500);
    return json({ root: await dropboxRoot() });
  }
  if (b.action === 'space') {
    // business accounts: switch between the whole team space and just your own folder
    let acct = null; try { acct = JSON.parse((await getConfig('dropbox_account')) || 'null'); } catch {}
    if (!acct?.teamRoot) return fail('This Dropbox account has no team space.');
    await setConfig('dropbox_path_root', b.team ? acct.teamRoot : null); forgetPathRoot();
    return json({ teamSpace: !!b.team });
  }
  if (b.action === 'mkdir') {
    const path = '/' + String(b.path || '').split('/').map((x) => x.trim()).filter(Boolean).join('/');
    if (path === '/') return fail('Name the folder.');
    try { await dropboxApi('files/create_folder_v2', { path, autorename: false }); } catch (e) { if (!/conflict|already/i.test(e.message)) return fail(e.message, 500); }
    return json({ ok: true, path });
  }
  if (b.action === 'folders') {
    try {
      const path = b.path && b.path !== '/' ? b.path : '';
      let r = await dropboxApi('files/list_folder', { path, limit: 2000, include_mounted_folders: true });
      const entries = [...(r.entries || [])];
      for (let n = 0; r.has_more && n < 5; n++) { r = await dropboxApi('files/list_folder/continue', { cursor: r.cursor }); entries.push(...(r.entries || [])); }
      const folders = entries.filter((e) => e['.tag'] === 'folder').map((e) => ({ name: e.name, path: e.path_display, team: !!e.sharing_info })).sort((a, c) => a.name.localeCompare(c.name));
      const files = entries.length - folders.length;
      return json({ path: path || '/', folders, files, teamSpace: !!(await getConfig('dropbox_path_root')) });
    } catch (e) { return fail(e.message, 500); }
  }
  // status (re-checks the account each time, so business team space is picked up even on older connections)
  const refresh = (await getConfig('dropbox_refresh_token')) || process.env.DROPBOX_REFRESH_TOKEN;
  let account = null, problem = null;
  try { account = JSON.parse((await getConfig('dropbox_account')) || 'null'); } catch {}
  if (refresh) {
    try {
      const me = await dropboxApi('users/get_current_account', undefined, { noRoot: true });
      const ri = me.root_info || {};
      const teamRoot = ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id ? ri.root_namespace_id : null;
      const fresh = { name: me.name?.display_name, email: me.email, team: me.team?.name || (teamRoot ? 'Team' : null), teamRoot };
      if (JSON.stringify(fresh) !== JSON.stringify(account)) {
        const firstTime = !account?.teamRoot && teamRoot;
        account = fresh;
        await setConfig('dropbox_account', JSON.stringify(fresh));
        if (firstTime) { await setConfig('dropbox_path_root', teamRoot); forgetPathRoot(); }
        if (!teamRoot) { await setConfig('dropbox_path_root', null); forgetPathRoot(); }
      }
    } catch (e) { problem = e.message; }
    // App-folder apps can only see their own folder: detect that and say so
    if (!problem) {
      try {
        const appFolder = await isAppFolderApp();
        if (appFolder) problem = 'APP_FOLDER';
      } catch {}
    }
  }
  return json({ hasKeys, connected: !!refresh, account, problem, teamSpace: !!(await getConfig('dropbox_path_root')), root: await dropboxRoot(), redirect });
}

// An "App folder" app sees a sandbox where paths like /Apps don't exist and team space can't be reached.
// Telltale: listing the root works, but the account's team root can't be used, or the root shows nothing yet the account has files.
async function isAppFolderApp() {
  const me = await dropboxApi('users/get_current_account', undefined, { noRoot: true });
  const ri = me.root_info || {};
  if (ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id) {
    try {
      await dropboxApi('files/list_folder', { path: '', limit: 1 });
      return false;
    } catch (e) { return /invalid_root|no_permission|access/i.test(e.message); }
  }
  const usage = await dropboxApi('users/get_space_usage', undefined, { noRoot: true }).catch(() => null);
  const root = await dropboxApi('files/list_folder', { path: '', limit: 5 }, { noRoot: true });
  return !!usage && usage.used > 50 * 1024 * 1024 && !(root.entries || []).length;
}

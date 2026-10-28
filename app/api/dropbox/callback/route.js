import { setConfig, forgetDropboxToken, forgetPathRoot, dropboxApi, checkState } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dropbox sends you back here after you approve. Saves the long-lived key and returns to the Dropbox page.
export async function GET(req) {
  const url = new URL(req.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const back = (q) => Response.redirect(`${site}/dropbox?${q}`, 302);
  if (url.searchParams.get('error')) return back('error=' + encodeURIComponent(url.searchParams.get('error_description') || 'You cancelled.'));
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!code) return back('error=' + encodeURIComponent('Dropbox didn’t send a sign-in code. Try Connect Dropbox again.'));
  if (!checkState(state)) return back('error=' + encodeURIComponent('That sign-in link was too old. Click Connect Dropbox again and finish within the hour.'));

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: process.env.DROPBOX_APP_KEY, client_secret: process.env.DROPBOX_APP_SECRET, redirect_uri: `${site}/api/dropbox/callback` }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.refresh_token) return back('error=' + encodeURIComponent(j.error_description || 'Dropbox didn’t accept the connection.'));
  await setConfig('dropbox_refresh_token', j.refresh_token);
  forgetDropboxToken();
  try {
    const me = await dropboxApi('users/get_current_account', undefined, { noRoot: true });
    const ri = me.root_info || {};
    const team = ri['.tag'] === 'team' && ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id;
    await setConfig('dropbox_account', JSON.stringify({ name: me.name?.display_name, email: me.email, team: me.team?.name || (team ? 'Team' : null), teamRoot: team ? ri.root_namespace_id : null }));
    await setConfig('dropbox_path_root', team ? ri.root_namespace_id : null); // business: use the team space by default
    forgetPathRoot();
  } catch {}
  return back('connected=1');
}

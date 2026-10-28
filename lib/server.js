import { createClient } from '@supabase/supabase-js';

export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the signed-in user for a request (or null). */
export async function userFrom(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

export const isEngineerEmail = (email) =>
  !!email && !!process.env.ENGINEER_EMAIL && email.toLowerCase() === process.env.ENGINEER_EMAIL.toLowerCase();

/** Engineer check that works with or without the ENGINEER_EMAIL env var (falls back to app_config). */
export async function isEngineer(email) {
  if (!email) return false;
  if (isEngineerEmail(email)) return true;
  const { data } = await admin().from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  return !!data && data.value.toLowerCase() === email.toLowerCase();
}

/** Can this signed-in email open the project? */
export async function canSee(email, projectId) {
  if (await isEngineer(email)) return true;
  const e = String(email || '').toLowerCase();
  const { data } = await admin().from('projects').select('client_email, artist').eq('id', projectId).maybeSingle();
  if (!data || !e) return false;
  if (data.client_email && data.client_email.toLowerCase() === e) return true;
  return onTeam(e, data.artist);
}

/** Is this email on the artist's team? (Quietly false if the team table isn't set up yet.) */
export async function onTeam(email, artist) {
  if (!email || !artist) return false;
  const { data, error } = await admin().from('artist_members').select('email, artist').ilike('artist', artist);
  if (error) return false;
  return (data || []).some((m) => m.email.toLowerCase() === email.toLowerCase() && m.artist.toLowerCase() === artist.toLowerCase());
}

export const newToken = () => {
  const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = new Uint8Array(10); crypto.getRandomValues(b);
  return Array.from(b, (x) => a[x % a.length]).join('');
};

export const json = (data, status = 200) => Response.json(data, { status });
export const fail = (error, status = 400) => Response.json({ error }, { status });

export function toE164(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

export async function sendText(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !tok || !from) return { sent: false, reason: 'Texting is not set up yet (add your Twilio keys).' };
  const num = toE164(to);
  if (!num) return { sent: false, reason: 'No valid phone number on this project.' };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: num, From: from, Body: body }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return { sent: false, reason: j.message || 'Twilio refused the message.' };
  }
  return { sent: true };
}

/* ---------- Dropbox ---------- */
let dbxToken = null, dbxExp = 0;
/** Engineer-only settings kept in app_config (never readable from the browser). */
export async function getConfig(key) {
  const { data } = await admin().from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
export async function setConfig(key, value) {
  if (value == null) return admin().from('app_config').delete().eq('key', key);
  return admin().from('app_config').upsert({ key, value: String(value) });
}
export const forgetDropboxToken = () => { dbxToken = null; dbxExp = 0; };

export async function dropboxApi(endpoint, body) {
  const token = await dropboxToken();
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dropboxMessage(j, res.status));
  return j;
}

/** Turns Dropbox's error codes into something you can act on. */
export function dropboxMessage(j, status) {
  const e = String(j?.error_summary || j?.error?.['.tag'] || j?.error || '');
  const scope = j?.error?.required_scope || (e.match(/missing_scope\/?\.*([\w.]*)/) || [])[1];
  if (/missing_scope/.test(e) || scope) return `Dropbox needs one more permission${scope ? ` (${scope})` : ''}. In your Dropbox app’s Permissions tab tick files.metadata.read, files.content.read, files.content.write and account_info.read, click Submit, then click Reconnect here.`;
  if (/expired_access_token|invalid_access_token|invalid_grant/.test(e) || status === 401) return 'Dropbox signed out. Click Reconnect.';
  if (/not_found/.test(e)) return 'That folder isn’t in your Dropbox anymore.';
  return e || `Dropbox error (${status})`;
}

export async function dropboxToken() {
  if (dbxToken && Date.now() < dbxExp - 60_000) return dbxToken;
  const { DROPBOX_APP_KEY: key, DROPBOX_APP_SECRET: secret } = process.env;
  const refresh = (await getConfig('dropbox_refresh_token')) || process.env.DROPBOX_REFRESH_TOKEN;
  if (!key || !secret) throw new Error('Dropbox is not set up yet: add DROPBOX_APP_KEY and DROPBOX_APP_SECRET in Vercel.');
  if (!refresh) throw new Error('Dropbox isn’t connected yet. Open Dropbox in the sidebar and click Connect Dropbox.');
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: key, client_secret: secret }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description || 'Dropbox sign-in failed.');
  dbxToken = j.access_token;
  dbxExp = Date.now() + (j.expires_in || 14400) * 1000;
  return dbxToken;
}

const clean = (s) => String(s || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
export async function dropboxRoot() {
  const r = (await getConfig('dropbox_root')) ?? process.env.DROPBOX_ROOT ?? '/Clients';
  return ('/' + String(r).replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');
}
export async function dropboxFolder(artist, project, song) {
  const root = await dropboxRoot();
  return `${root}/${clean(artist)}/${clean(project)}/${clean(song)}`;
}
export function dropboxPath(folder, relativeName) {
  const parts = String(relativeName || 'file').split('/').filter(Boolean).map(clean);
  return `${folder}/${parts.join('/')}`;
}

export async function dropboxUploadLink(path) {
  const token = await dropboxToken();
  const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_upload_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ commit_info: { path, mode: 'add', autorename: true, mute: false }, duration: 3600 }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_summary || 'Dropbox would not create an upload link.');
  return j.link;
}

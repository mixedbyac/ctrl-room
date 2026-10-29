import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

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
  if (error || !data.user) return null;
  // two-step verification: a session only counts once the code was entered
  const claims = jwtClaims(token);
  if ((data.user.factors || []).some((f) => f.status === 'verified') && claims.aal !== 'aal2') {
    // a remembered device ("Remember this device" on the two-step check) counts as checked
    const { data: t } = await admin().from('trusted_sessions').select('session_id, trusted_devices(expires_at)').eq('session_id', claims.session_id || '00000000-0000-0000-0000-000000000000').eq('user_id', data.user.id).maybeSingle();
    if (!t || !(new Date(t.trusted_devices?.expires_at || 0) > new Date())) return null;
  }
  data.user.claims = claims;
  return data.user;
}

/** Reads the (already verified) access token's claims: aal, amr, app_metadata. */
export function jwtClaims(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}
export const needsVerify = (user) => !!user?.app_metadata?.needs_verify;

export const isEngineerEmail = (email) =>
  !!email && !!process.env.ENGINEER_EMAIL && email.toLowerCase() === process.env.ENGINEER_EMAIL.toLowerCase();

/** Engineer check that works with or without the ENGINEER_EMAIL env var (falls back to app_config). */
export async function isEngineer(who) {
  const user = typeof who === 'object' ? who : null;
  const email = user ? user?.email : who;
  if (!email) return false;
  if (isEngineerEmail(email)) return true;
  const { data } = await admin().from('app_config').select('key, value').like('key', 'engineer_email%');
  const hit = (data || []).find((r) => (r.key === 'engineer_email' || r.key.startsWith('engineer_email:')) && r.value.toLowerCase() === email.toLowerCase());
  if (!hit) return false;
  // engineers are invite-only: an added engineer's account only counts once their email is proven (the main engineer always counts)
  if (hit.key !== 'engineer_email' && user && needsVerify(user)) return false;
  return true;
}

/** Can this signed-in email open the project? */
export async function canSee(email, projectId) {
  if (await isEngineer(typeof email === 'object' ? email?.email : email)) return true;
  const e = String((typeof email === 'object' ? email?.email : email) || '').toLowerCase();
  if (typeof email === 'object' && needsVerify(email)) return false; // unconfirmed accounts see nothing yet
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

/** The original engineer (owner) — only they can add or remove other engineers. */
export async function isOwner(email) {
  if (!email) return false;
  if (process.env.ENGINEER_EMAIL && email.toLowerCase() === process.env.ENGINEER_EMAIL.toLowerCase()) return true;
  const { data } = await admin().from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
  return !!data && data.value.toLowerCase() === email.toLowerCase();
}

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

let pathRootCache = { v: undefined, at: 0 };
/** Business accounts: point every call at the team space (shared team folders) instead of just your own folder. */
export async function dropboxPathRootHeader() {
  if (pathRootCache.v === undefined || Date.now() - pathRootCache.at > 60_000) {
    pathRootCache = { v: (await getConfig('dropbox_path_root')) || '', at: Date.now() };
  }
  return pathRootCache.v ? { 'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: pathRootCache.v }) } : {};
}
export const forgetPathRoot = () => { pathRootCache = { v: undefined, at: 0 }; };

export async function dropboxApi(endpoint, body, { noRoot = false } = {}) {
  const token = await dropboxToken();
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(noRoot ? {} : await dropboxPathRootHeader()), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
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
// Client files land in <root>/<Artist>/<files>. (A dropped folder keeps its own sub-folders inside.)
/** Portal sends land in Dropbox as  <root>/<Artist>/<Song> (2026-10-29)/…files  — one folder per artist, one folder per song per send. */
export async function dropboxFolder(artist, project, song, when) {
  const root = await dropboxRoot();
  const day = new Date(when || Date.now()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
  const name = clean(song || project || 'Files');
  return `${root}/${clean(artist || 'Unknown artist')}/${name} (${day})`;
}
export function dropboxPath(folder, relativeName) {
  const parts = String(relativeName || 'file').split('/').filter(Boolean).map(clean);
  return `${folder}/${parts.join('/')}`;
}

export async function dropboxUploadLink(path) {
  const token = await dropboxToken();
  const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_upload_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(await dropboxPathRootHeader()) },
    body: JSON.stringify({ commit_info: { path, mode: 'add', autorename: true, mute: false }, duration: 3600 }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_summary || 'Dropbox would not create an upload link.');
  return j.link;
}


/** Signed, self-checking OAuth state: works across tabs, retries and account switches (no saved state needed). */
const stateKey = () => process.env.DROPBOX_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ctrl-room';
export function signState() {
  const ts = Date.now().toString(36), nonce = newToken();
  const mac = createHmac('sha256', stateKey()).update(`${ts}.${nonce}`).digest('base64url').slice(0, 32);
  return `${ts}.${nonce}.${mac}`;
}
export function checkState(state, maxAgeMs = 60 * 60 * 1000) {
  const [ts, nonce, mac] = String(state || '').split('.');
  if (!ts || !nonce || !mac) return false;
  const want = createHmac('sha256', stateKey()).update(`${ts}.${nonce}`).digest('base64url').slice(0, 32);
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Date.now() - parseInt(ts, 36) < maxAgeMs;
}


/** Dropbox-API-Arg must be plain ASCII: escape anything else as \\uXXXX. */
const dbxArg = (o) => JSON.stringify(o).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/** Big files: upload in pieces through Dropbox upload sessions. step = 'start' | 'append' | 'finish'. */
export async function dropboxChunk(step, { session, offset = 0, path, data }) {
  const token = await dropboxToken();
  const endpoint = step === 'start' ? 'upload_session/start' : step === 'append' ? 'upload_session/append_v2' : 'upload_session/finish';
  const arg = step === 'start' ? { close: false }
    : step === 'append' ? { cursor: { session_id: session, offset }, close: false }
    : { cursor: { session_id: session, offset }, commit: { path, mode: 'add', autorename: true, mute: false } };
  const res = await fetch(`https://content.dropboxapi.com/2/files/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': dbxArg(arg), 'Content-Type': 'application/octet-stream', ...(await dropboxPathRootHeader()) },
    body: data,
  });
  const text = await res.text();
  let j = {}; try { j = JSON.parse(text || '{}'); } catch {}
  if (!res.ok) throw new Error(dropboxMessage(j, res.status) || text.slice(0, 200));
  return j;
}

/**
 * The signed-in engineer for a request, or null. Uses the same check as the app itself (the is_engineer() database
 * function, run as the user), so if the app shows you the engineer side, engineer-only routes let you in too.
 */
export async function engineerFrom(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return { user: null, why: 'Please sign in again.' };
  const user = await userFrom(req);
  if (user && (await isEngineer(user))) return { user };
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await db.rpc('is_engineer');
    if (data) {
      const { data: u } = await admin().auth.getUser(token);
      if (u?.user) return { user: u.user };
    }
  } catch {}
  return { user: null, why: user ? 'Only engineers can do this.' : 'Your sign-in expired. Refresh the page (or sign in again) and try once more.' };
}

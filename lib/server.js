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
export async function dropboxToken() {
  if (dbxToken && Date.now() < dbxExp - 60_000) return dbxToken;
  const { DROPBOX_APP_KEY: key, DROPBOX_APP_SECRET: secret, DROPBOX_REFRESH_TOKEN: refresh } = process.env;
  if (!key || !secret || !refresh) throw new Error('Dropbox is not set up yet (add your Dropbox keys).');
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
export function dropboxFolder(artist, project, song) {
  const root = (process.env.DROPBOX_ROOT || '/Clients').replace(/\/+$/, '');
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

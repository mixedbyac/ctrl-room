'use client';
import { createClient } from '@supabase/supabase-js';

let client = null;

export function supabase() {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
  }
  return client;
}

/** Calls one of our server routes with the signed-in user's token. */
export async function api(path, body) {
  let { data } = await supabase().auth.getSession();
  // refresh a token that's about to run out, so the server never sees an expired sign-in
  if (data.session?.expires_at && data.session.expires_at * 1000 < Date.now() + 60_000) ({ data } = await supabase().auth.refreshSession());
  const send = (token) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  let res = await send(data.session?.access_token);
  let json = await res.json().catch(() => ({}));
  // the server didn't accept the sign-in (an old token, e.g. after the Mac app slept): get a fresh one and try once more
  if ((res.status === 401 || res.status === 403) && /sign-in|sign in/i.test(json.error || '') && data.session) {
    const { data: fresh } = await supabase().auth.refreshSession();
    if (fresh?.session?.access_token) { res = await send(fresh.session.access_token); json = await res.json().catch(() => ({})); }
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

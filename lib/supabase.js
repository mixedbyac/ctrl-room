'use client';
import { createClient } from '@supabase/supabase-js';

let client = null;
let annT = 0;
// a short pause so a burst of writes refreshes pages once
function announce() {
  if (typeof window === 'undefined') return;
  clearTimeout(annT);
  annT = setTimeout(() => import('@/lib/live').then((m) => m.changed()).catch(() => {}), 350);
}

export function supabase() {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      // any write (status, approval, notes, versions…) tells every open page to refresh, so they all agree
      global: { fetch: (url, opts = {}) => fetch(url, opts).then((r) => { const m = String(opts.method || 'GET').toUpperCase(); if (m !== 'GET' && m !== 'HEAD' && r.ok && /\/rest\/v1\//.test(String(url)) && !/\/rest\/v1\/(plays|trusted_devices|app_config|rpc\/(is_|get_|my_|can_|touch|log|claim_|trust_|forget_))/.test(String(url))) announce(); return r; }) },
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
  if (res.ok && !/\/api\/(share\/view|portal\/files|session|me|spotify|people$|team$|downloads$|signin-code)/.test(path)) announce();
  let json = await res.json().catch(() => ({}));
  // the server didn't accept the sign-in (an old token, e.g. after the Mac app slept): get a fresh one and try once more
  if ((res.status === 401 || res.status === 403) && /sign-in|sign in/i.test(json.error || '') && data.session) {
    const { data: fresh } = await supabase().auth.refreshSession();
    if (fresh?.session?.access_token) { res = await send(fresh.session.access_token); json = await res.json().catch(() => ({})); }
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

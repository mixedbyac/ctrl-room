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
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase';

let cache = null, pending = null;
/** Engineer only: email -> display name for everyone with an account (from People). */
export function useNames(enabled = true) {
  const [m, setM] = useState(cache || {});
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    if (!cache && !pending) pending = api('/api/people', { action: 'list' }).then((r) => { cache = Object.fromEntries((r.people || []).map((p) => [p.email, p.name || p.full_name || ''])); return cache; }).catch(() => ({})).finally(() => { pending = null; });
    (cache ? Promise.resolve(cache) : pending || Promise.resolve({})).then((x) => { if (live) setM(x || {}); });
    return () => { live = false; };
  }, [enabled]);
  return m;
}
/** A person's name for display: their display name, else the start of their email. */
export const nameFor = (names, email, fallback = 'Someone') => {
  if (!email) return fallback;
  const e = String(email).toLowerCase();
  return names[e] || e.replace(/@.*/, '');
};

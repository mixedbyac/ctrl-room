'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

let cache = null, pending = null;
function load(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = supabase().from('artists').select('name, display_name, image_url').then(({ data }) => {
    cache = Object.fromEntries((data || []).map((a) => [a.name.toLowerCase(), a])); pending = null; return cache;
  }, () => { pending = null; return {}; });
  return pending;
}
export function useArtistProfiles() {
  const [m, setM] = useState(cache || {});
  useEffect(() => { let live = true; load().then((x) => live && setM(x)); return () => { live = false; }; }, []);
  return m;
}

/** An artist's name with their little Spotify picture, like the engineer credit. */
export default function ArtistName({ name, link = false, className = '' }) {
  const m = useArtistProfiles();
  if (!name) return null;
  const a = m[String(name).toLowerCase()];
  const label = a?.display_name || name;
  const inner = <>{a?.image_url ? <img src={a.image_url} alt="" /> : <i aria-hidden="true">{label[0]?.toUpperCase()}</i>}<span>{label}</span></>;
  return link
    ? <Link className={`artistname ${className}`} href={`/artists?a=${encodeURIComponent(name)}`} onClick={(e) => e.stopPropagation()}>{inner}</Link>
    : <span className={`artistname ${className}`}>{inner}</span>;
}

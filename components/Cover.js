'use client';
import { useEffect, useState } from 'react';
import { makeArt } from '@/lib/art';
import { supabase } from '@/lib/supabase';

const signedCache = new Map(); // storage path -> { url, exp }
async function coverUrl(path) {
  const hit = signedCache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const { data } = await supabase().storage.from('mixes').createSignedUrl(path, 24 * 3600);
  if (data?.signedUrl) signedCache.set(path, { url: data.signedUrl, exp: Date.now() + 24 * 3600 * 1000 });
  return data?.signedUrl || '';
}

/** Cover art: your uploaded image when there is one (`path`), otherwise generated from `seed`. */
export default function Cover({ seed: seedIn, path: pathIn, size = 480, className, alt = '', as = 'img', children, style }) {
  const gen = typeof pathIn === 'string' && pathIn.startsWith('gen:');
  const seed = gen ? Number(pathIn.slice(4)) || seedIn : seedIn, path = gen ? null : pathIn;
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    if (path) coverUrl(path).then((u) => { if (live) setSrc(u || makeArt(seed, size)); });
    else setSrc(makeArt(seed, size));
    return () => { live = false; };
  }, [seed, size, path]);
  if (as === 'img') {
    return src
      ? <img src={src} alt={alt} className={className} style={{ objectFit: 'cover', ...style }} />
      : <span className={className} style={{ display: 'block', background: '#1a1a1c', ...style }} />;
  }
  return (
    <div className={className} style={{ ...(src ? { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}), ...style }}>
      {children}
    </div>
  );
}

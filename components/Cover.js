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

// A light colour taken from the cover (for a faint tint behind a page). Returns 'r, g, b' or ''.
const tintCache = new Map();
function tintOf(src) {
  if (tintCache.has(src)) return Promise.resolve(tintCache.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        // the most colourful pixels count most, so a mostly-black cover still gives its accent colour
        let R = 0, G = 0, B = 0, W = 0;
        for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); const w = 1 + (mx - mn) * 2; R += d[i] * w; G += d[i + 1] * w; B += d[i + 2] * w; W += w; }
        let [h, s] = rgbToHs(R / W, G / W, B / W);
        const out = hslToRgb(h, Math.max(s, 0.45), 0.72).join(', '); // light version of it
        tintCache.set(src, out); resolve(out);
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}
function rgbToHs(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, Math.min(1, s)];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
/** useCoverTint({ src }) for a ready URL, or ({ seed, path }) like <Cover>. */
export function useCoverTint({ src: given, seed: seedIn, path: pathIn }) {
  const [t, setT] = useState('');
  useEffect(() => {
    let live = true;
    const gen = typeof pathIn === 'string' && pathIn.startsWith('gen:');
    const seed = gen ? Number(pathIn.slice(4)) || seedIn : seedIn, path = gen ? null : pathIn;
    (async () => {
      const src = given || (path ? await coverUrl(path) : '') || makeArt(seed, 120);
      if (!src) return;
      const out = await tintOf(src);
      if (live) setT(out);
    })();
    return () => { live = false; };
  }, [given, seedIn, pathIn]);
  return t;
}

/** A faint wash of the cover's light colour behind a page or panel (no blur, so every browser draws it). */
export function CoverTint({ src, seed, path, className = 'covertint' }) {
  const t = useCoverTint({ src, seed, path });
  return <div className={className} aria-hidden="true" style={t ? { '--tint': t } : undefined} />;
}

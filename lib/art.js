'use client';
// Generated blurred-gradient cover art, the same look as the prototype.
const cache = new Map();

function rng(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

export function makeArt(seed, size = 480) {
  const key = `${seed}:${size}`;
  if (cache.has(key)) return cache.get(key);
  if (typeof document === 'undefined') return '';
  const r = rng(seed), c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = r() * 360, comp = h + 150 + r() * 60, side = h + (r() < 0.5 ? -40 : 40);
  const pal = [
    [h, 55 + r() * 20, 62 + r() * 12], [comp, 55 + r() * 25, 48 + r() * 12],
    [side, 45 + r() * 20, 38 + r() * 10], [h, 60, 78], [comp + 20, 40, 30],
  ];
  g.fillStyle = hsl(h, 35, 16);
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 9; k++) {
    const x = r() * size, y = r() * size, rad = size * (0.35 + r() * 0.55), [ph, ps, pl] = pal[k % pal.length];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, hsl(ph, ps, pl, 0.95));
    gr.addColorStop(0.55, hsl(ph, ps, pl, 0.45));
    gr.addColorStop(1, hsl(ph, ps, pl, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  const vg = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = vg;
  g.fillRect(0, 0, size, size);
  const im = g.getImageData(0, 0, size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  const url = c.toDataURL('image/jpeg', 0.88);
  cache.set(key, url);
  return url;
}

export const hashStr = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/**
 * The one rule for artwork, used everywhere (lists, song page, mini player, Now Playing, share links):
 * a song uses its project's cover unless it was given its own (an uploaded image, or "gen:<seed>" from Shuffle).
 */
export function artOf(song, project) {
  const own = song?.cover_path;
  if (own && String(own).startsWith('gen:')) return { seed: Number(String(own).slice(4)) || song.seed, path: null };
  if (own) return { seed: song.seed, path: own };
  if (project) return { seed: project.seed ?? song?.seed, path: project.cover_path || null };
  return { seed: song?.seed, path: null };
}
export const hasOwnArt = (song) => !!song?.cover_path;

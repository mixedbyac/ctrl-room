// The CTRL ROOM waveform look (same as the About page): rounded bars, yellow for what you've heard,
// gray for what's ahead, and a white playhead with a soft glow. One drawing used by every player.
export const WAVE = { played: '#f5d547', ahead: '#4a4a52', head: '#ffffff' };

/** Draw into a canvas. size: 'lg' (players), 'sm' (mini bars). Returns nothing. */
export function drawWave(el, { peaks, prog = 0, size = 'lg', hover = null, head = true }) {
  if (!el) return;
  const r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (!W || !H) return;
  if (el.width !== W || el.height !== H) { el.width = W; el.height = H; }
  const g = el.getContext('2d'); g.clearRect(0, 0, W, H);
  const bw = (size === 'sm' ? 2 : 3) * dpr, gap = (size === 'sm' ? 1.5 : 2) * dpr, step = bw + gap;
  const n = Math.max(1, Math.floor((W + gap) / step)), off = (W - (n * step - gap)) / 2;
  const rad = bw / 2;
  // each bar: a blend of the loudest and the average moment in its slice (pure peaks make loud masters look like solid blocks)
  const raw = new Array(n).fill(0.08);
  if (peaks?.length) {
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
      let mx = 0, sum = 0; for (let j = a; j < b; j++) { const v = peaks[j] || 0; sum += v; if (v > mx) mx = v; }
      raw[i] = mx * 0.45 + (sum / (b - a)) * 0.55;
    }
    // stretch the range so quiet and loud parts read differently: quietest bars low, loudest full, with a gentle curve
    const sorted = [...raw].sort((x, y) => x - y), lo = sorted[Math.floor(n * 0.04)] || 0, hi = sorted[Math.floor(n * 0.985)] || 1;
    const span = Math.max(0.02, hi - lo);
    for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (raw[i] - lo) / span)); raw[i] = 0.1 + 0.9 * Math.pow(t, 1.6); }
  }
  for (let i = 0; i < n; i++) {
    const h = Math.max(bw, raw[i] * H * 0.96), x = off + i * step, y = (H - h) / 2;
    g.fillStyle = (i + 0.5) / n <= prog ? WAVE.played : WAVE.ahead;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, bw, h, rad); else g.rect(x, y, bw, h);
    g.fill();
  }
  if (head && prog > 0) {
    const x = Math.round(prog * W);
    g.save(); g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = 10 * dpr; g.fillStyle = WAVE.head;
    g.fillRect(x - dpr, 0, 2 * dpr, H); g.restore();
  }
  if (hover != null) { g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.fillRect(Math.round(hover * dpr), 0, Math.max(1, dpr), H); g.globalAlpha = 1; }
}

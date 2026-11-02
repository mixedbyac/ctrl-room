// The CTRL ROOM waveform look (same as the About page): chunky rounded bars, yellow for what you've heard,
// gray for what's ahead, and a white playhead with a soft glow. One drawing used by every player.
export const WAVE = { played: '#f5d547', ahead: '#4a4a52', head: '#ffffff' };

/** Draw into a canvas. size: 'lg' (players), 'sm' (mini bars). Returns nothing. */
export function drawWave(el, { peaks, prog = 0, size = 'lg', hover = null, head = true }) {
  if (!el) return;
  const r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (!W || !H) return;
  if (el.width !== W || el.height !== H) { el.width = W; el.height = H; }
  const g = el.getContext('2d'); g.clearRect(0, 0, W, H);
  const bw = (size === 'sm' ? 2.5 : 4) * dpr, gap = (size === 'sm' ? 1.5 : 2.4) * dpr, step = bw + gap;
  const n = Math.max(1, Math.floor((W + gap) / step)), off = (W - (n * step - gap)) / 2;
  const rad = bw / 2;
  for (let i = 0; i < n; i++) {
    let p = 0.08;
    if (peaks?.length) { const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length)); p = 0; for (let j = a; j < b; j++) p = Math.max(p, peaks[j] || 0); }
    const h = Math.max(bw, Math.min(1, p) * H * 0.94), x = off + i * step, y = (H - h) / 2;
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

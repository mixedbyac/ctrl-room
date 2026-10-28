'use client';
// Reads an audio file in the browser to build its waveform and loudness numbers.
// Nothing here changes the file: it's decoded only to measure, and the original is what gets uploaded and played.

/** Integrated loudness (LUFS) per ITU-R BS.1770-4 / EBU R128: K-weighting, 400 ms blocks, -70 LUFS and -10 LU gates. */
export function integratedLufs(channels, fs) {
  const chans = channels.slice(0, 2);
  if (!chans.length || !fs) return null;
  // K-weighting coefficients for any sample rate (same formulas as libebur128)
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416), Q1 = 0.7071752369554196;
  let a0 = 1 + K / Q1 + K * K;
  const A = [(Vh + (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q1 + K * K) / a0];
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const B = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0];

  const seg = Math.round(fs * 0.1); // 100 ms steps; 4 steps = one 400 ms block (75% overlap)
  const nSeg = Math.floor(chans[0].length / seg);
  if (nSeg < 4) return null;
  const segSum = new Float64Array(nSeg);
  for (const x of chans) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, w1 = 0, w2 = 0;
    for (let s = 0; s < nSeg; s++) {
      let acc = 0;
      for (let i = s * seg, e = i + seg; i < e; i++) {
        const v = x[i];
        const y = A[0] * v + A[1] * x1 + A[2] * x2 - A[3] * y1 - A[4] * y2; // high shelf
        x2 = x1; x1 = v;
        const w = B[0] * y + B[1] * y1 + B[2] * y2 - B[3] * w1 - B[4] * w2;  // high pass
        y2 = y1; y1 = y; w2 = w1; w1 = w;
        acc += w * w;
      }
      segSum[s] += acc;
    }
  }
  const n = seg * 4, blocks = [];
  for (let s = 0; s + 3 < nSeg; s++) blocks.push((segSum[s] + segSum[s + 1] + segSum[s + 2] + segSum[s + 3]) / n);
  const L = (z) => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter((z) => z > 0 && L(z) > -70);
  if (!abs.length) return null;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((z) => L(z) > rel);
  if (!gated.length) return null;
  return Math.round(L(gated.reduce((a, b) => a + b, 0) / gated.length) * 10) / 10;
}

export async function analyseFile(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const n = 1000, a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
    const step = Math.max(1, Math.floor(a.length / n)), peaks = new Array(n).fill(0);
    let pk = 0, sum = 0;
    for (let i = 0; i < a.length; i++) {
      const x = Math.max(Math.abs(a[i]), Math.abs(b[i]));
      if (x > pk) pk = x;
      sum += (a[i] * a[i] + b[i] * b[i]) / 2;
      const j = Math.min(n - 1, Math.floor(i / step));
      if (x > peaks[j]) peaks[j] = x;
    }
    const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : null);
    let lufs = null;
    try { lufs = integratedLufs(buf.numberOfChannels > 1 ? [a, b] : [a], buf.sampleRate); } catch {}
    return {
      duration: buf.duration,
      peaks: peaks.map((x) => Math.round(x * 1000) / 1000),
      peak_db: db(pk),
      rms_db: db(Math.sqrt(sum / a.length)),
      lufs,
    };
  } finally {
    ctx.close?.();
  }
}

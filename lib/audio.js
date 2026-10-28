'use client';
// Reads an audio file in the browser to build its waveform and loudness numbers.
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
    return {
      duration: buf.duration,
      peaks: peaks.map((x) => Math.round(x * 1000) / 1000),
      peak_db: db(pk),
      rms_db: db(Math.sqrt(sum / a.length)),
    };
  } finally {
    ctx.close?.();
  }
}

// Figures out what client files are, and a song's BPM and key, right in the browser.
// Nothing is uploaded or changed to do this: the audio is only decoded locally to listen to it.

const AUDIO = /\.(wav|wave|aiff?|aifc|flac|mp3|m4a|aac|ogg|opus)$/i;
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };

export const isAudio = (name) => AUDIO.test(name || '');

/** What a file is, from its name: Lead vocal, Background vocal, Beat, Rough mix, Stem, Session, Archive, MIDI… */
export function fileKind(name) {
  const n = String(name || '').toLowerCase();
  const base = n.split('/').pop();
  if (/\.(zip|rar|7z|tar|gz)$/.test(base)) return 'Archive';
  if (/\.(logicx|ptx|ptf|als|flp|cpr|rpp|song|aup3|bwproject)$/.test(base) || /\.logicx\//.test(n)) return 'Session';
  if (/\.(mid|midi)$/.test(base)) return 'MIDI';
  if (/\.(pdf|txt|rtf|docx?|pages|md)$/.test(base)) return /lyric/.test(base) ? 'Lyrics' : 'Notes';
  if (/\.(png|jpe?g|heic|gif|webp)$/.test(base)) return 'Image';
  if (/\.(mp4|mov|m4v)$/.test(base)) return 'Video';
  if (!AUDIO.test(base)) return 'File';
  const w = base.replace(/\.[a-z0-9]+$/, '').replace(/[_\-.]+/g, ' ');
  if (/\b(lead|main|lv|ld)\s?(vox|vocals?|voc)?\b|\blead\b/.test(w) && /\b(vox|vocals?|voc|lv|ld)\b/.test(w)) return 'Lead vocal';
  if (/\b(bgv?s?|bvs?|backing|backgrounds?|harmon(y|ies)|adlibs?|ad libs?|dbls?|doubles?|stacks?|hooks? stack|choir)\b/.test(w)) return 'Background vocal';
  if (/\b(vox|vocals?|voc|acapella|a capella|acap|verse|hook)\b/.test(w)) return 'Vocal';
  if (/\b(instrumental|inst|beat|music only|track ?out|no vox|novox)\b/.test(w)) return 'Beat';
  if (/\b(rough|demo|ref|reference|mix|bounce|master|2 ?trk|2 ?track|stereo|full song|print)\b/.test(w)) return 'Rough mix';
  if (/\b(kick|snare|hat|hats|hh|clap|perc|drums?|808|bass|sub|keys(?! of)|piano|rhodes|organ|gtr|guitars?|synths?|pads?|strings?|fx|sfx|pluck|lead synth|bell|horns?|brass|loop|chords?|arp|melody)\b/.test(w)) return 'Stem';
  return 'Audio';
}

/** "12 stems · 2 vocals · rough mix · session" */
export function describeFiles(files) {
  const c = {};
  for (const f of files) { const k = fileKind(f.webkitRelativePath || f.name); c[k] = (c[k] || 0) + 1; }
  const order = ['Rough mix', 'Beat', 'Lead vocal', 'Vocal', 'Background vocal', 'Stem', 'Audio', 'Session', 'Archive', 'MIDI', 'Lyrics', 'Notes', 'Image', 'Video', 'File'];
  const plural = { 'Rough mix': 'rough mixes', Beat: 'beats', 'Lead vocal': 'lead vocals', Vocal: 'vocals', 'Background vocal': 'background vocals', Stem: 'stems', Audio: 'audio files', Session: 'sessions', Archive: 'zips', MIDI: 'MIDI files', Lyrics: 'lyric sheets', Notes: 'notes', Image: 'images', Video: 'videos', File: 'other files' };
  return order.filter((k) => c[k]).map((k) => (c[k] === 1 ? k.toLowerCase().replace('archive', 'zip') : `${c[k]} ${plural[k]}`)).join(' · ');
}

/** BPM and key written in a name: "Song 140bpm F#m", "Song_Cmin_92" */
export function hintsFromName(name) {
  const s = String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  let bpm = null, key = null;
  const b = s.match(/(\d{2,3}(?:\.\d)?)\s*-?\s*bpm\b/i) || s.match(/\bbpm\s*-?\s*(\d{2,3}(?:\.\d)?)/i);
  if (b && +b[1] >= 50 && +b[1] <= 220) bpm = Math.round(+b[1]);
  const k = s.match(/(?:^|[\s_\-(\[.])([A-G])(#|b|♯|♭|\s?sharp|\s?flat)?\s?(maj(?:or)?|min(?:or)?|m)(?=$|[\s_\-)\].\d])/i)
    || s.match(/\bkey\s*(?:of\s*)?([A-G])(#|b|♯|♭)?\s?(maj(?:or)?|min(?:or)?|m)?\b/i);
  if (k && k[1] === k[1].toUpperCase()) {
    const acc = (k[2] || '').trim().toLowerCase();
    const note = k[1] + (acc === '#' || acc === '♯' || acc === 'sharp' ? '#' : acc === 'b' || acc === '♭' || acc === 'flat' ? 'b' : '');
    const minor = /^m(in(or)?)?$/i.test(k[3] || '') && !/^maj/i.test(k[3] || '');
    const idx = NOTE_INDEX[note.toUpperCase()] ?? NOTE_INDEX[note];
    if (idx != null) key = `${NOTES[idx]} ${minor ? 'minor' : 'major'}`;
  }
  return { bpm, key };
}

/** Removes BPM/key/version tags so a file or folder name reads like a song title. */
export function titleSource(name) {
  return String(name || '')
    .replace(/(\.[a-z0-9]{2,6})+$/i, '')
    .replace(/[(\[]?\s*key\s*(of\s*)?[A-G](#|b|♯|♭)?\s?(maj(or)?|min(or)?|m)?\s*[)\]]?/gi, ' ')
    .replace(/(\d{2,3}(?:\.\d)?)\s*-?\s*bpm\b|\bbpm\s*-?\s*\d{2,3}/gi, ' ')
    .replace(/(^|[\s_\-(\[.])[A-G](#|b|♯|♭)?\s?(maj(?:or)?|min(?:or)?)(?=$|[\s_\-)\].])/g, ' ')
    .replace(/(^|[\s_\-(\[.])[A-G](#|b)?m(?=$|[\s_\-)\].])/g, ' ')
    .replace(/\b(stems?|multis?|multitracks?|track ?outs?|session files?|files|lead vox|vocals?|vox|bgvs?|consolidated|bounced?|final|v\d+|rough mix|rough|demo|reference|ref|instrumental|inst|beat|stack \d*|stacks?|acapella|2 ?trk|bounce|print|master|mix \d*)\b/gi, ' ')
    .replace(/[\s_\-]+\d{1,3}$/g, ' ')
    .replace(/[(\[]\s*[)\]]/g, ' ')
    .replace(/[\s_\-]+$/g, '').replace(/^[\s_\-]+/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** The file most worth listening to for tempo and key: a rough mix or beat beats a single stem. */
export function pickListenFile(files) {
  const audio = files.filter((f) => isAudio(f.name) && f.size > 50_000 && f.size < 400 * 1024 * 1024);
  if (!audio.length) return null;
  const score = (f) => {
    const k = fileKind(f.webkitRelativePath || f.name);
    return ({ 'Rough mix': 6, Beat: 5, Audio: 3, 'Lead vocal': 1, Vocal: 1, Stem: 0, 'Background vocal': 0 })[k] ?? 2;
  };
  return [...audio].sort((a, b) => score(b) - score(a) || b.size - a.size)[0];
}

// ---------- signal processing ----------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Mono, ~11 kHz, a 60-second window from the meat of the song. */
function prepare(channels, sr, seconds = 60) {
  const len = channels[0].length, dur = len / sr;
  const start = Math.floor(sr * Math.min(Math.max(0, dur * 0.2), Math.max(0, dur - seconds)));
  const end = Math.min(len, start + Math.floor(sr * seconds));
  const factor = Math.max(1, Math.round(sr / 11025));
  const outSr = sr / factor, n = Math.floor((end - start) / factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < channels.length; c++) for (let j = 0; j < factor; j++) acc += channels[c][start + i * factor + j] || 0;
    out[i] = acc / (factor * channels.length);
  }
  return { x: out, sr: outSr };
}

const hann = (n) => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

export function detectBpm(channels, sampleRate) {
  const { x, sr } = prepare(channels, sampleRate);
  const N = 1024, hop = 128, win = hann(N), fps = sr / hop;
  const frames = Math.floor((x.length - N) / hop);
  if (frames < 200) return null;
  const env = new Float64Array(frames);
  let prev = new Float64Array(N / 2);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let flux = 0;
    const cur = new Float64Array(N / 2);
    for (let k = 1; k < N / 2; k++) {
      cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) flux += d;
    }
    env[f] = flux; prev = cur;
  }
  // remove the slow trend so only the hits are left
  const w = Math.round(fps * 0.5), od = new Float64Array(frames);
  let run = 0;
  for (let i = 0; i < frames; i++) {
    run += env[i]; if (i >= w) run -= env[i - w];
    od[i] = Math.max(0, env[i] - run / Math.min(i + 1, w));
  }
  const ac = (lag) => { let s = 0; for (let i = lag; i < frames; i++) s += od[i] * od[i - lag]; return s / (frames - lag); };
  const minLag = Math.floor((60 * fps) / 200), maxLag = Math.ceil((60 * fps) / 60);
  const acs = new Float64Array(maxLag * 2 + 2);
  for (let l = 1; l < acs.length && l < frames - 1; l++) acs[l] = ac(l);
  let best = -1, bestLag = 0;
  for (let l = minLag; l <= maxLag; l++) {
    const bpm = (60 * fps) / l;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2)); // people usually feel 80–150
    const sc = (acs[l] + 0.5 * (acs[2 * l] || 0) + 0.25 * (acs[Math.round(l / 2)] || 0)) * prior;
    if (sc > best) { best = sc; bestLag = l; }
  }
  if (!bestLag) return null;
  // refine between frames
  const a = acs[bestLag - 1], b = acs[bestLag], c = acs[bestLag + 1];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  let bpm = (60 * fps) / (bestLag + Math.max(-0.5, Math.min(0.5, shift)));
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}

// Krumhansl–Kessler key profiles
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db || 1);
}

export function detectKey(channels, sampleRate) {
  const { x, sr } = prepare(channels, sampleRate, 90);
  const N = 8192, hop = 4096, win = hann(N);
  const frames = Math.floor((x.length - N) / hop);
  if (frames < 4) return null;
  const chroma = new Float64Array(12), bass = new Float64Array(12), ends = new Float64Array(12);
  const re = new Float64Array(N), im = new Float64Array(N);
  const binPc = new Int8Array(N / 2).fill(-1), isBass = new Uint8Array(N / 2);
  for (let k = 1; k < N / 2; k++) {
    const hz = (k * sr) / N;
    if (hz < 55 || hz > 2000) continue;
    binPc[k] = ((Math.round(12 * Math.log2(hz / 440)) % 12) + 12 + 9) % 12; // 0 = C
    if (hz < 250) isBass[k] = 1;
  }
  for (let f = 0; f < frames; f++) {
    let energy = 0;
    for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * win[i]; im[i] = 0; energy += re[i] * re[i]; }
    if (energy < 1e-6) continue;
    fft(re, im);
    const frame = new Float64Array(12), fb = new Float64Array(12);
    for (let k = 1; k < N / 2; k++) if (binPc[k] >= 0) { const m = Math.sqrt(Math.hypot(re[k], im[k])); frame[binPc[k]] += m; if (isBass[k]) fb[binPc[k]] += m; }
    const mx = Math.max(...frame) || 1, mb = Math.max(...fb) || 1;
    // the bottom note of each moment counts most toward the home key
    const low = fb.indexOf(Math.max(...fb));
    for (let i = 0; i < 12; i++) { chroma[i] += frame[i] / mx; bass[i] += fb[i] / mb; }
    if (low >= 0) bass[low] += 1;
    if (f < frames * 0.12 || f > frames * 0.9) for (let i = 0; i < 12; i++) ends[i] += fb[i] / mb;
  }
  const scores = [];
  for (let t = 0; t < 12; t++) {
    const rot = Array.from({ length: 12 }, (_, i) => chroma[(i + t) % 12]);
    scores.push({ t, mode: 'major', r: corr(rot, MAJOR) }, { t, mode: 'minor', r: corr(rot, MINOR) });
  }
  scores.sort((a, b) => b.r - a.r);
  let best = scores[0];
  if (best.r < 0.3) return null;
  // relative major/minor share the same notes: settle it by which home note the bass lands on more
  const relT = best.mode === 'major' ? (best.t + 9) % 12 : (best.t + 3) % 12;
  const rel = scores.find((x) => x.t === relT && x.mode !== best.mode);
  if (rel && best.r - rel.r < 0.2) {
    const tonicWeight = (t) => bass[t] + 0.6 * ends[t] + 0.4 * (bass[(t + 7) % 12]);
    if (tonicWeight(rel.t) > tonicWeight(best.t) * 1.08) best = rel;
  }
  return `${NOTES[best.t]} ${best.mode}`;
}

/** Listens to one file and returns { bpm, key } (either can be null). */
export async function analyseSong(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch = [buf.getChannelData(0)];
    if (buf.numberOfChannels > 1) ch.push(buf.getChannelData(1));
    await new Promise((r) => setTimeout(r, 0));
    const bpm = detectBpm(ch, buf.sampleRate);
    await new Promise((r) => setTimeout(r, 0));
    const key = detectKey(ch, buf.sampleRate);
    return { bpm, key };
  } finally {
    ctx.close?.();
  }
}

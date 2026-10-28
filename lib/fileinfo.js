'use client';
// Reads the real format straight from the file's header (no decoding, nothing changed).

function ext80(view, o) { // AIFF sample rate: 80-bit IEEE extended
  const exp = view.getUint16(o) & 0x7fff, hi = view.getUint32(o + 2), lo = view.getUint32(o + 6);
  if (!exp && !hi && !lo) return 0;
  return (hi * 2 ** 32 + lo) * 2 ** (exp - 16383 - 63);
}
const str = (view, o, n) => String.fromCharCode(...Array.from({ length: n }, (_, i) => view.getUint8(o + i)));

export async function readFileInfo(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const info = { file_name: file.name, file_size: file.size, file_format: ext.toUpperCase(), sample_rate: null, bit_depth: null, lossless: !['mp3', 'm4a', 'aac', 'ogg', 'opus'].includes(ext) };
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(head);
    if (str(v, 0, 4) === 'RIFF' && str(v, 8, 4) === 'WAVE') {
      info.file_format = 'WAV';
      let o = 12;
      while (o + 8 <= v.byteLength) {
        const id = str(v, o, 4), size = v.getUint32(o + 4, true);
        if (id === 'fmt ') {
          const fmt = v.getUint16(o + 8, true);
          info.sample_rate = v.getUint32(o + 12, true);
          info.bit_depth = v.getUint16(o + 22, true);
          const isFloat = fmt === 3 || (fmt === 0xfffe && size >= 40 && v.getUint16(o + 32, true) === 3);
          if (isFloat) info.bit_depth = -info.bit_depth; // negative = float
          break;
        }
        o += 8 + size + (size % 2);
      }
    } else if (str(v, 0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(str(v, 8, 4))) {
      info.file_format = 'AIFF';
      let o = 12;
      while (o + 8 <= v.byteLength) {
        const id = str(v, o, 4), size = v.getUint32(o + 4);
        if (id === 'COMM') { info.bit_depth = v.getUint16(o + 14); info.sample_rate = Math.round(ext80(v, o + 16)); break; }
        o += 8 + size + (size % 2);
      }
    } else if (str(v, 0, 4) === 'fLaC') {
      info.file_format = 'FLAC';
      // STREAMINFO: sample rate (20 bits) at byte 18, bits per sample (5 bits) after channels
      const b = (i) => v.getUint8(8 + i);
      info.sample_rate = (b(10) << 12) | (b(11) << 4) | (b(12) >> 4);
      info.bit_depth = (((b(12) & 1) << 4) | (b(13) >> 4)) + 1;
    }
  } catch { /* header unreadable: keep the basics */ }
  return info;
}

export function describeFormat(v) {
  if (!v?.file_format) return '';
  const parts = [v.file_format];
  if (v.bit_depth) parts.push(v.bit_depth < 0 ? `${-v.bit_depth}-bit float` : `${v.bit_depth}-bit`);
  if (v.sample_rate) parts.push(`${(v.sample_rate / 1000).toFixed(v.sample_rate % 1000 ? 1 : 0)} kHz`);
  return parts.join(' · ');
}

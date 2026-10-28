// Audio quality tier from the file's real format (read from its header when it was uploaded).
// Lossless: WAV/AIFF/FLAC/ALAC up to 48 kHz. Hi-Res Lossless: lossless above 48 kHz (88.2, 96, 192…).
const LOSSLESS = ['WAV', 'AIFF', 'AIF', 'FLAC', 'ALAC'];
export function quality(v) {
  if (!v) return null;
  const fmt = String(v.file_format || '').toUpperCase();
  const lossless = v.lossless === true || LOSSLESS.includes(fmt);
  const lossy = v.lossless === false || ['MP3', 'M4A', 'AAC', 'OGG', 'OPUS'].includes(fmt);
  const bits = v.bit_depth ? (v.bit_depth < 0 ? `${-v.bit_depth}-bit float` : `${v.bit_depth}-bit`) : '';
  const khz = v.sample_rate ? `${(v.sample_rate / 1000).toFixed(v.sample_rate % 1000 ? 1 : 0)} kHz` : '';
  const detail = [bits, khz].filter(Boolean).join(' / ');
  if (lossless && !lossy) {
    const hires = (v.sample_rate || 0) > 48000;
    return { tier: hires ? 'hires' : 'lossless', label: hires ? 'Hi-Res Lossless' : 'Lossless', short: hires ? 'Hi-Res' : 'Lossless', detail, format: fmt };
  }
  if (lossy) return { tier: 'lossy', label: fmt || 'Compressed', short: fmt || 'Compressed', detail, format: fmt };
  return null;
}

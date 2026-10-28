// Turns a mix file name into a song title + version label.
// "John Doe - He Is Holy - Mix 1.wav"  ->  { title: 'He Is Holy', label: 'v1', extras: [] }
// "he_is_holy_v2.1_INSTRUMENTAL.wav"    ->  { title: 'He Is Holy', label: 'v2.1', extras: ['Instrumental'] }

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

const VERSION_RE = /\b(?:mix|mx|v|ver|version|rev|revision|take|print|pass)[\s._-]*(\d+(?:\.\d+)?)\b/i;
const EXTRAS = [
  ['instrumental', 'Instrumental'], ['inst', 'Instrumental'], ['acapella', 'Acapella'], ['a cappella', 'Acapella'], ['acappella', 'Acapella'],
  ['clean', 'Clean'], ['explicit', 'Explicit'], ['dirty', 'Explicit'], ['radio edit', 'Radio edit'], ['radio', 'Radio edit'],
  ['tv track', 'TV track'], ['tv', 'TV track'], ['master', 'Master'], ['mastered', 'Master'], ['stems', 'Stems'], ['stem', 'Stems'],
  ['no vox', 'No vocals'], ['novox', 'No vocals'], ['main', 'Main'], ['ref', 'Reference'], ['rough', 'Rough'], ['final', 'Final'],
];
const NOISE = /^(wav|aif|aiff|mp3|m4a|flac|24bit|24 bit|16bit|16 bit|48k|44k|44\.1k|96k|bounce|bounced|export|stereo|mixdown|feat|ft|prod)$/i;

function titleCase(s) {
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s; // keep the client's own casing
  return s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

export function parseMixName(fileName, { artist = '', project = '', knownArtists = [] } = {}) {
  let base = String(fileName || '').split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '');
  base = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  base = base.replace(/^\d{1,3}(?:\s*[-.]\s+|\s+-\s*)/, ''); // leading track number ("01 - Song")

  // version anywhere in the name
  let label = null;
  const vm = VERSION_RE.exec(base);
  if (vm) { label = `v${vm[1]}`; base = (base.slice(0, vm.index) + ' ' + base.slice(vm.index + vm[0].length)).trim(); }

  // split into parts on " - ", "–", "—", "|", or parentheses
  let parts = base.split(/\s+[-–—|]\s+|\s*[–—|]\s*|\s+-|-\s+|[()[\]]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1 && /-/.test(parts[0]) && !/\s/.test(parts[0])) parts = parts[0].split('-');

  const extras = [];
  // no artist given: use a known artist if one appears, else assume "Artist - Song"
  let foundArtist = artist;
  if (!artist) {
    const known = parts.find((p) => knownArtists.some((k) => norm(k) === norm(p)));
    const glued = !known && knownArtists.find((k) => parts.some((p) => p.toLowerCase().startsWith(k.toLowerCase() + ' ')));
    if (known) foundArtist = knownArtists.find((k) => norm(k) === norm(known));
    else if (glued) foundArtist = glued;
    else {
      const content = parts.filter((p) => norm(p) && !NOISE.test(p.trim()) && !EXTRAS.some(([k]) => norm(k) === norm(p)));
      if (content.length >= 2) foundArtist = titleCase(content[0]);
    }
  }
  const a = norm(foundArtist), pr = norm(project);
  parts = parts.filter((p) => {
    const n = norm(p);
    if (!n) return false;
    if (a && (n === a || n === norm(`by ${artist}`))) return false;
    if (pr && n === pr) return false;
    if (NOISE.test(p.trim())) return false;
    const ex = EXTRAS.find(([k]) => n === norm(k));
    if (ex) { if (!extras.includes(ex[1])) extras.push(ex[1]); return false; }
    return true;
  });

  // pull trailing extras off the remaining title ("He Is Holy Instrumental")
  let title = parts[0] || '';
  for (const [k, v] of EXTRAS) {
    const re = new RegExp(`\\s+${k.replace(/\s+/g, '\\s+')}$`, 'i');
    if (re.test(title) && title.replace(re, '').trim()) { title = title.replace(re, '').trim(); if (!extras.includes(v)) extras.push(v); }
  }
  // no dashes or underscores in song names: "He-Is-Holy" / "He – Is Holy" -> "He Is Holy"
  title = title.replace(/[\u2010-\u2015\u2212_-]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.,:;|]+|[\s.,:;|]+$/g, '').trim();
  // artist glued to the front ("John Doe He Is Holy", "John Doe-He-Is-Holy")
  if (foundArtist && title.toLowerCase().startsWith(foundArtist.toLowerCase().replace(/[-_]+/g, ' ') + ' ')) title = title.slice(foundArtist.length).trim();
  title = titleCase(title);

  return { title, label, extras, note: extras.join(' · '), artist: foundArtist || '' };
}

/** Finds the song a parsed title belongs to (ignores case, spaces and punctuation). */
export function matchSong(songs, title) {
  const n = norm(title);
  if (!n) return null;
  return songs.find((s) => norm(s.title) === n) || null;
}

/** Picks a version label: the one from the file name if it's free, otherwise the next number. */
export function pickLabel(parsedLabel, versions, nextLabel) {
  if (parsedLabel && !versions.some((v) => v.label.toLowerCase() === parsedLabel.toLowerCase())) return parsedLabel;
  return nextLabel(versions);
}

// Notes → a MIDI file of markers. Drag it into a Logic session (or File › Import › MIDI File, with markers on)
// and every timed note shows up as a marker at its exact second.
const PPQ = 960;
const vlq = (n) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const text = (s) => Array.from(new TextEncoder().encode(String(s))).slice(0, 120);

/** notes: [{ t, label }] (t in seconds). bpm: the song's tempo (Logic places markers by bar, so it has to match). */
export function markersMidi({ notes, bpm = 120, name = 'CTRL ROOM notes' }) {
  const tempo = Math.round(60000000 / (bpm > 30 && bpm < 300 ? bpm : 120)); // microseconds per beat
  const ev = [];
  ev.push(0, 0xff, 0x03, ...vlq(text(name).length), ...text(name));
  ev.push(0, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255);
  ev.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8); // 4/4
  let last = 0;
  [...notes].filter((n) => n.t != null).sort((a, b) => a.t - b.t).forEach((n) => {
    const tick = Math.round(n.t * (1e6 / tempo) * PPQ);
    const t = text(n.label);
    ev.push(...vlq(Math.max(0, tick - last)), 0xff, 0x06, ...vlq(t.length), ...t);
    last = tick;
  });
  ev.push(0, 0xff, 0x2f, 0x00);
  const head = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255];
  const trk = [0x4d, 0x54, 0x72, 0x6b, ...u32(ev.length), ...ev];
  return new Blob([new Uint8Array([...head, ...trk])], { type: 'audio/midi' });
}

const mm = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** Save the file for one song's open notes. */
export function exportToLogic({ song, notes, bpm }) {
  const list = notes.filter((n) => n.t != null && !n.parent_id && !n.resolved)
    .map((n) => ({ t: n.t, label: `${mm(n.t)} ${(n.author_name || (n.from_client ? 'Client' : 'Engineer')).replace(/\s*\(.*?\)\s*/g, ' ').trim()}: ${n.body}`.slice(0, 110) }));
  if (!list.length) return 0;
  const blob = markersMidi({ notes: list, bpm: Number(bpm) || 120, name: `${song.title} notes` });
  const a = document.createElement('a'); const href = URL.createObjectURL(blob);
  a.href = href; a.download = `${String(song.title).replace(/[\\/:*?"<>|]+/g, '-')} - notes.mid`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
  return list.length;
}

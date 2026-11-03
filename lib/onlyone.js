'use client';
// Only one thing plays at a time, everywhere: across the app's players, share links, and other open tabs or windows.
// Starting playback anywhere pauses everything else.
const els = new Set();
const me = Math.random().toString(36).slice(2);
let ch = null;
const others = (keep) => els.forEach((a) => { if (a !== keep && !a.paused && !a.muted) { try { a.pause(); a.dispatchEvent(new Event('ctrl-room:stopped')); } catch {} } });
function setup() {
  if (ch !== null || typeof window === 'undefined') return;
  try { ch = new BroadcastChannel('ctrl-room-audio'); ch.onmessage = (e) => { if (e.data?.from !== me) others(null); }; } catch { ch = false; }
}
/** Register an <audio> / Audio(). Returns the same element. */
export function onlyOne(a) {
  if (!a || els.has(a)) return a;
  setup();
  els.add(a);
  a.addEventListener('playing', () => { if (a.muted) return; others(a); try { ch && ch.postMessage({ from: me, at: Date.now() }); } catch {} });
  a.addEventListener('volumechange', () => { if (!a.muted && !a.paused) { others(a); try { ch && ch.postMessage({ from: me }); } catch {} } });
  return a;
}
export const forget = (a) => els.delete(a);

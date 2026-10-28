'use client';
import { useEffect, useRef, useState } from 'react';
import { filesFromDrop, hasFiles } from '@/lib/dropfiles';

const LINES = [
  'Drop it like it’s hot',
  'Let it rain',
  'Mic drop',
  'Bombs away',
  'Send it to the CTRL ROOM',
  'Feed the machine',
  'Hand over the goods',
  'Let it go',
  'Drop the beat (literally)',
  'Big files, big dreams',
  'Air drop, but better',
  'Bless the speakers',
  'Make it rain stems',
  'We’re gonna need a bigger hard drive',
  'Release the vocals',
  'Clear for landing',
  'Into the vault',
  'Fresh out the studio',
  'No stems left behind',
  'Unleash the session',
];

/** Full-screen "drop anywhere" overlay with a random line each time. Song cards still catch their own drops. */
export default function DropAnywhere({ onFiles }) {
  const [on, setOn] = useState(false);
  const [line, setLine] = useState(LINES[0]);
  const depth = useRef(0);
  const cb = useRef(onFiles); cb.current = onFiles;

  useEffect(() => {
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (depth.current++ === 0) { setLine(LINES[Math.floor(Math.random() * LINES.length)]); setOn(true); }
    };
    const over = (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
    const leave = (e) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOn(false); };
    const drop = async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0; setOn(false);
      const got = await filesFromDrop(e.dataTransfer);
      if (got.files.length || got.folders.length) cb.current(got);
    };
    const reset = () => { depth.current = 0; setOn(false); };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', reset);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', reset); window.removeEventListener('blur', reset);
    };
  }, []);

  // card drops stop here (they call stopPropagation), so reset the overlay for those too
  useEffect(() => {
    if (!on) return;
    const done = () => { depth.current = 0; setOn(false); };
    document.addEventListener('drop', done, true);
    return () => document.removeEventListener('drop', done, true);
  }, [on]);

  if (!on) return null;
  return (
    <div className="dropall" aria-hidden="true">
      <div className="dropall-in">
        <div className="dropall-rec"><span /></div>
        <p className="dropall-line up">{line}</p>
        <p className="dropall-sub">Drop anywhere. Folders become songs, or drop onto a song card to put files right there.</p>
      </div>
    </div>
  );
}

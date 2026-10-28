'use client';
import { useEffect, useState } from 'react';
import { makeArt } from '@/lib/art';

/** Rows of cover art drifting left and right behind the sign-in card, like film strips. Dim and quiet. */
export default function CoverDrift() {
  const [covers, setCovers] = useState(null);
  useEffect(() => {
    fetch('/api/covers').then((r) => r.json()).then((j) => setCovers(j.covers || [])).catch(() => setCovers([]));
  }, []);
  if (covers === null) return <div className="drift" aria-hidden="true" />;
  // no playlist yet: generated covers so the page still has motion
  const list = covers.length ? covers : Array.from({ length: 18 }, (_, i) => ({ img: makeArt(1000 + i * 7919, 240), link: null }));
  const rows = [0, 1, 2, 3].map((r) => {
    const row = list.filter((_, i) => i % 4 === r);
    const fill = [...(row.length ? row : list)];
    while (fill.length < 8) fill.push(...fill.slice(0, 8 - fill.length));
    return fill;
  });
  return (
    <div className="drift" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className={`driftrow ${r % 2 ? 'right' : 'left'}`} style={{ '--dur': `${70 + r * 14}s` }}>
          {[...row, ...row].map((c, i) => (c.link
            ? <a key={i} href={c.link} target="_blank" rel="noopener noreferrer" tabIndex={-1} className="driftc" title={[c.title, c.artist].filter(Boolean).join(' · ')}><img src={c.img} alt="" loading="lazy" /></a>
            : <span key={i} className="driftc"><img src={c.img} alt="" loading="lazy" /></span>))}
        </div>
      ))}
    </div>
  );
}

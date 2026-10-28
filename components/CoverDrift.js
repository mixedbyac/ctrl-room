'use client';
import { useEffect, useState } from 'react';
import { makeArt } from '@/lib/art';

/** Rows of cover art drifting left and right behind the sign-in card, like film strips. Dim and quiet. */
export default function CoverDrift() {
  const [covers, setCovers] = useState(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px), (hover: none)');
    setPhone(mq.matches);
    fetch('/api/covers').then((r) => r.json()).then((j) => setCovers(j.covers || [])).catch(() => setCovers([]));
  }, []);
  if (covers === null) return <div className="drift" aria-hidden="true" />;
  // no playlist yet: generated covers so the page still has motion
  const list = covers.length ? covers : Array.from({ length: 24 }, (_, i) => ({ img: makeArt(1000 + i * 7919, 200), link: null }));
  const nRows = phone ? 8 : 4; // phones: fill the whole screen
  const size = phone ? '200x200' : '300x300';
  const rows = Array.from({ length: nRows }, (_, r) => {
    const fill = list.filter((_, i) => i % nRows === r);
    const row = [...(fill.length ? fill : list)];
    while (row.length < 8) row.push(...row.slice(0, 8 - row.length));
    return row;
  });
  const src = (c) => c.img.replace('300x300', size);
  return (
    <div className={`drift ${phone ? 'full' : ''}`} aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className={`driftrow ${r % 2 ? 'right' : 'left'}`} style={{ '--dur': `${(phone ? 55 : 70) + r * 9}s` }}>
          {[...row, ...row].map((c, i) => (c.link && !phone
            ? <a key={i} href={c.link} target="_blank" rel="noopener noreferrer" tabIndex={-1} className="driftc" title={[c.title, c.artist].filter(Boolean).join(' · ')}><img src={src(c)} alt="" loading="lazy" decoding="async" /></a>
            : <span key={i} className="driftc"><img src={src(c)} alt="" loading="lazy" decoding="async" /></span>))}
        </div>
      ))}
    </div>
  );
}

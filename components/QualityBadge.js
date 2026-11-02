'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { quality } from '@/lib/quality';

const WAVES = <svg viewBox="0 0 28 16" aria-hidden="true"><path d="M2 12c2-8 4-8 5 0s3 8 5 0 3-8 5 0 3 8 5 0 3-6 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" /></svg>;

/**
 * "Lossless" / "Hi-Res Lossless" badge for a version. size: 'sm' | 'md' | 'lg'. detail adds "24-bit / 96 kHz".
 * info: a quiet, tappable tag (like Apple Music's) that opens a card explaining the file.
 */
export default function QualityBadge({ v, size = 'sm', detail = false, showLossy = false, short = false, info = false }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [open]);
  const q = quality(v);
  if (!q || (q.tier === 'lossy' && !showLossy && !info)) return null;
  const lossy = q.tier === 'lossy';
  const tip = lossy
    ? `${q.format}${q.detail ? ` · ${q.detail}` : ''}. Compressed, not lossless. Upload a WAV, AIFF or FLAC for lossless.`
    : `${q.label}${q.detail ? ` · ${q.detail}` : ''} · ${q.format}. Plays exactly as delivered, bit for bit.`;
  if (info) {
    return (
      <>
        <button type="button" className={`qtag ${q.tier}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label={`${lossy ? q.format : q.label}. More about this file`}>
          {!lossy && WAVES}<span>{lossy ? q.format : q.label}</span>
        </button>
        {open && typeof document !== 'undefined' && createPortal(
          <div className="qsheet" role="dialog" aria-modal="true" aria-label={q.label} onClick={() => setOpen(false)}>
            <div className="qcard" onClick={(e) => e.stopPropagation()}>
              <span className={`qicon ${q.tier}`}>{lossy ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> : WAVES}</span>
              <b>{lossy ? 'Compressed file' : q.label}</b>
              <p>{lossy
                ? `This version is a ${q.format}, so some detail was removed to make it smaller. Ask for a WAV, AIFF or FLAC to hear it lossless.`
                : `${q.tier === 'hires' ? 'Studio resolution, beyond CD quality.' : 'CD quality or better.'} You’re hearing the exact file your engineer delivered, bit for bit, with nothing compressed.`}</p>
              <dl>
                <div><dt>Format</dt><dd>{q.format}</dd></div>
                {q.detail && <div><dt>Resolution</dt><dd>{q.detail}</dd></div>}
                {v?.label && <div><dt>Version</dt><dd>{v.label}</dd></div>}
              </dl>
              <button type="button" className="qok" onClick={() => setOpen(false)} autoFocus>OK</button>
            </div>
          </div>, document.body)}
      </>
    );
  }
  return (
    <span className={`qbadge ${q.tier} ${size}`} title={tip} aria-label={tip}>
      {!lossy && (
        <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M1 7h2M5 3.5v7M8 1v12M11 4v6M14 2v10M17 5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
      )}
      <span>{short ? q.short : q.label}</span>
      {detail && q.detail && <em>{q.detail}</em>}
    </span>
  );
}

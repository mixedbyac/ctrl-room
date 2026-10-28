import { quality } from '@/lib/quality';

/** "Lossless" / "Hi-Res Lossless" badge for a version. size: 'sm' | 'md' | 'lg'. detail adds "24-bit / 96 kHz". */
export default function QualityBadge({ v, size = 'sm', detail = false, showLossy = false, short = false }) {
  const q = quality(v);
  if (!q || (q.tier === 'lossy' && !showLossy)) return null;
  const tip = q.tier === 'lossy'
    ? `${q.format}${q.detail ? ` · ${q.detail}` : ''}. Compressed, not lossless. Upload a WAV, AIFF or FLAC for lossless.`
    : `${q.label}${q.detail ? ` · ${q.detail}` : ''} · ${q.format}. Plays exactly as delivered, bit for bit.`;
  return (
    <span className={`qbadge ${q.tier} ${size}`} title={tip} aria-label={tip}>
      {q.tier !== 'lossy' && (
        <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M1 7h2M5 3.5v7M8 1v12M11 4v6M14 2v10M17 5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
      )}
      <span>{short ? q.short : q.label}</span>
      {detail && q.detail && <em>{q.detail}</em>}
    </span>
  );
}

import Link from 'next/link';
import PoweredBy from '@/components/PoweredBy';

export const metadata = { title: 'How to prep your files · CTRL ROOM' };

// The steps are kept as data so they're easy to edit.
const STEPS = [
  { t: 'Bounce every track from the start', d: 'Export each track as its own file, all starting at the very beginning of the song (bar 1, 0:00), even if the part comes in later. That keeps everything lined up.' },
  { t: 'Use WAV files', d: '24-bit WAV at the session’s sample rate (44.1 or 48 kHz) is best. Please no MP3s for the stems.' },
  { t: 'Turn off processing on the master', d: 'Remove any limiter, compressor or EQ on the master bus before exporting, and make sure nothing clips.' },
  { t: 'Name files clearly', d: 'Use the instrument or part, like “Lead Vox”, “BGV Left”, “808”, “Kick”. Add the song title and BPM to the folder name, like “He Is Holy 140bpm”.' },
  { t: 'Include a rough mix and the beat', d: 'A stereo bounce of your rough mix (it becomes the demo the mixes get compared to), plus the instrumental if you have one.' },
  { t: 'One folder per song, then zip it', d: 'Put each song’s files in its own folder. Zip the folder (right-click › Compress on Mac, or Send to › Compressed folder on Windows). Up to 2 GB per upload.' },
  { t: 'Add notes in the Portal', d: 'References, the vibe you want, anything that matters. You can also add a “Need it by” date.' },
];

export default function Prep() {
  return (
    <main className="protect prep">
      <header className="pr-top">
        <Link href="/portal" className="pr-brand"><img src="/logo.png" alt="" /><span>CTRL ROOM</span></Link>
        <nav><Link className="btn small primary" href="/portal">Start a mix</Link></nav>
      </header>
      <section className="pr-hero">
        <p className="pr-eyebrow">Before you send</p>
        <h1 className="up">How to prep your files</h1>
        <p className="pr-lede">A few minutes here saves a lot of back-and-forth, and gets your mix started sooner.</p>
      </section>
      <ol className="prepsteps">
        {STEPS.map((s, i) => (
          <li key={s.t}><span className="prepn mono">{String(i + 1).padStart(2, '0')}</span><div><b>{s.t}</b><p>{s.d}</p></div></li>
        ))}
      </ol>
      <div className="prepcta"><Link className="btn primary" href="/portal">I’m ready, start a mix</Link></div>
      <PoweredBy />
    </main>
  );
}

import Link from 'next/link';
import PoweredBy from '@/components/PoweredBy';

export const metadata = { title: 'How to prep your files · CTRL ROOM' };

// The steps are kept as data so they're easy to edit.
const STEPS = [
  { t: 'WAV stems, labeled', d: 'Label every stem, like Lead Vocal, BG Vocal, Inst, Kick, Snare and so on.', extra: 'Include 1 MP3 of the full reference mix (whatever MP3 version of the song you are currently listening to).' },
  { t: 'All WAVs should be dry', d: 'No mixing or effects: no EQ, compression, etc.', extra: 'Please include Tune on vocals, or include your tune settings.' },
  { t: 'Make sure all stems line up', d: 'All audio files, including vocals and the instrumental, should play in sync without timing issues when stacked.' },
  { t: 'Key and BPM in the name', d: 'If possible, put the key and BPM in the folder name or the instrumental’s file name, like “Song name 80bpm A Major”. You can also send this info by messaging me directly.' },
  { t: 'Folder or zip, then send', d: 'Place the WAV stems and the reference MP3 in a folder or zip folder and send them here, through sendfileshere.com.', link: true },
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
        <p className="pr-lede">Instructions for sending files. A few minutes here saves a lot of back-and-forth and gets your mix started sooner.</p>
      </section>
      <ol className="prepsteps">
        {STEPS.map((s, i) => (
          <li key={s.t}><span className="prepn mono">{String(i + 1).padStart(2, '0')}</span><div><b>{s.t}</b><p>{s.d}</p>{s.extra && <p className="prepx">{s.extra}</p>}{s.link && <p><Link className="link" href="/portal">Send your files ›</Link></p>}</div></li>
        ))}
      </ol>
      <div className="prepcta"><Link className="btn primary" href="/portal">I’m ready, start a mix</Link></div>
      <PoweredBy />
    </main>
  );
}

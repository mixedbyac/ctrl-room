'use client';
import './about.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PORTAL_URL } from '@/lib/site';
import { useApp } from '@/components/AppShell';

const BARS = 96;
// a song-shaped waveform: quiet intro, a lift, the drop, a breakdown, the outro
const PEAKS = Array.from({ length: BARS }, (_, i) => {
  const x = i / BARS, r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const env = x < 0.12 ? 0.25 + x * 3 : x < 0.3 ? 0.55 : x < 0.62 ? 0.92 : x < 0.72 ? 0.4 : x < 0.9 ? 0.85 : 0.85 - (x - 0.9) * 7;
  return Math.max(0.08, Math.min(1, env * (0.55 + r * 0.45)));
});
const FILES = ['Lead Vox.wav', 'Beat.wav', '808.wav', 'Adlibs.wav', 'Demo.mp3', 'Harmonies.wav'];
const NOTES = [
  { at: 0.24, who: 'Maya', text: 'More vocal here' },
  { at: 0.47, who: 'Jay (Manager)', text: 'Love this drop' },
  { at: 0.74, who: 'Maya', text: 'Can the 808 hit harder?' },
];
const CHAPTERS = [
  { h: 'Send your files.', p: <>Drop stems, bounces and a demo at {PORTAL_URL.replace(/^https?:\/\//, '')}. They’re filed for your engineer before you close the tab.</> },
  { h: 'Hear the mix take shape.', p: 'Each new mix shows up the moment it’s bounced. Press play anywhere: your phone, your laptop, your lock screen.' },
  { h: 'Leave notes at the exact second.', p: 'Tap where you hear it. Your note sits right on the waveform, so nobody has to guess what “around the second verse” means.' },
  { h: 'Flip between versions.', p: 'Every version stays stacked. Switch mid-song and keep your spot to hear exactly what changed.' },
  { h: 'Approve it.', p: 'One tap when it’s right. Your engineer and your whole team see it’s final.' },
  { h: 'Take it with you.', p: 'Download the finals, or send a link that plays with the cover art. Your music stays private until you share it.' },
];
const N = CHAPTERS.length;
const clamp = (v) => Math.max(0, Math.min(1, v));

export default function About() {
  const { session } = useApp() || {};
  const stage = useRef(null);
  const [step, setStep] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches); sync(); mq.addEventListener?.('change', sync);
    let raf = 0, last = -1;
    const tick = () => {
      raf = 0;
      const el = stage.current; if (!el) return;
      const r = el.getBoundingClientRect(), total = r.height - window.innerHeight;
      const p = clamp(-r.top / Math.max(1, total));
      el.style.setProperty('--p', p.toFixed(4));
      // each chapter gets its own 0→1 so its picture can play out
      for (let i = 0; i < N; i++) el.style.setProperty(`--c${i}`, clamp(p * N - i).toFixed(4));
      const s = Math.min(N - 1, Math.floor(p * N));
      if (s !== last) { last = s; setStep(s); }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); mq.removeEventListener?.('change', sync); cancelAnimationFrame(raf); };
  }, []);

  return (
    <main className={`ab ${still ? 'still' : ''}`}>
      <header className="abtop">
        <Link href="/about" className="ablogo"><img src="/logo.png" alt="" /><span>CTRL ROOM</span></Link>
        <nav>{session ? <Link href="/">Back to CTRL ROOM</Link> : <Link href="/login">Sign in</Link>}</nav>
      </header>

      <section className="abhero">
        <h1 aria-label="CTRL ROOM">
          <span className="abword">CTRL</span>
          <span className="abwave" aria-hidden="true">{PEAKS.slice(20, 68).map((v, i) => <i key={i} style={{ '--v': v, '--d': `${i * 18}ms` }} />)}</span>
          <span className="abword">ROOM</span>
        </h1>
        <p className="ablede">Where artists and their engineer finish the mix together. Files, notes, versions and approvals, all in one room.</p>
        <div className="abcta">
          <Link className="abbtn" href="/signup">Make your account</Link>
          <a className="abbtn ghost" href={PORTAL_URL}>Send files</a>
        </div>
        <p className="abscroll" aria-hidden="true">Scroll to hear how it works</p>
      </section>

      <section className="abstage" ref={stage} data-step={step} aria-label="How CTRL ROOM works">
        <div className="absticky">
          <ol className="abrail" aria-hidden="true">{CHAPTERS.map((c, i) => <li key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}</ol>
          <div className="abcopy">
            {CHAPTERS.map((c, i) => (
              <div key={i} className={`abch ${i === step ? 'on' : ''}`} aria-hidden={i !== step}>
                <span className="abnum">{i + 1} of {N}</span>
                <h2>{c.h}</h2>
                <p>{c.p}</p>
              </div>
            ))}
          </div>

          <div className="abscene" aria-hidden="true">
            {/* 1: files fly in */}
            <div className="abfiles">{FILES.map((f, i) => <span key={f} className="abfile" style={{ '--i': i, '--a': `${(i / FILES.length) * 360}deg` }}>{f}</span>)}</div>

            {/* 4: versions stacked behind */}
            <div className="abvers">{['v1', 'v2', 'v3'].map((v, i) => <span key={v} className="abver" style={{ '--i': i }}>{v}</span>)}</div>

            {/* the song */}
            <div className="abplayer">
              <div className="abmeta"><span className="abcover" /><span><b>Late Again</b><small>Maya Rivers · {step >= 3 ? 'v3' : 'v1'}</small></span></div>
              <div className="abwf">
                {PEAKS.map((v, i) => <i key={i} style={{ '--v': v, '--x': i / BARS }} />)}
                <span className="abhead" />
                {NOTES.map((n, i) => (
                  <span key={i} className={`abnote ${n.at > 0.6 ? 'flip' : ''}`} style={{ '--at': n.at }}>
                    <span className="abdot" />
                    <span className="abbubble"><b>{n.who}</b>{n.text}</span>
                  </span>
                ))}
              </div>
              <div className="abstamp">Approved ✓</div>
              <div className="abshare"><span className="abdl">Download all</span><span className="abdl ghost">Copy link</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="abend">
        <h2>Ready when your next mix is.</h2>
        <p>Artists and their teams sign up free. Engineers join by invite.</p>
        <div className="abcta">
          <Link className="abbtn" href="/signup">Make your account</Link>
          <Link className="abbtn ghost" href="/login">Sign in</Link>
        </div>
      </section>
      <footer className="abfoot">Powered by ARTHOUSE · <a href="https://art-house.us">art-house.us</a></footer>
    </main>
  );
}

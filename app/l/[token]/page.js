'use client';
import QualityBadge from '@/components/QualityBadge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Cover from '@/components/Cover';
import { mmss, deviceName } from '@/lib/format';
import SpotifyMark from '@/components/SpotifyMark';
import LinkComments from '@/components/LinkComments';

const PLAY = <path d="M7 4.5v15l13-7.5z" />;
const PAUSE = <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />;
const BINS = 100;

function Art({ src, seed, size, className }) {
  if (src) return <img src={src} alt="" className={className} style={{ objectFit: 'cover' }} />;
  return <Cover as="div" seed={seed} size={size} className={className} />;
}

function Wave({ peaks, time, duration, onSeek }) {
  const cv = useRef(null), wrap = useRef(null);
  useEffect(() => {
    const el = cv.current; if (!el) return;
    const r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (!W || !H) return;
    if (el.width !== W || el.height !== H) { el.width = W; el.height = H; }
    const g = el.getContext('2d'); g.clearRect(0, 0, W, H);
    const step = 3 * dpr, n = Math.floor(W / step), prog = duration ? time / duration : 0;
    for (let i = 0; i < n; i++) {
      let p = 0.08;
      if (peaks?.length) { const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length)); p = 0; for (let j = a; j < b; j++) p = Math.max(p, peaks[j] || 0); }
      const h = Math.max(2 * dpr, Math.min(1, p) * H * 0.96);
      g.fillStyle = i / n < prog ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.28)';
      g.fillRect(i * step, (H - h) / 2, 2 * dpr, h);
    }
  });
  const at = (e) => { const r = wrap.current.getBoundingClientRect(); onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration); };
  return <div ref={wrap} className="npwave lwave" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }} onPointerMove={(e) => { if (e.buttons) at(e); }}><canvas ref={cv} /></div>;
}

export default function SharedListen() {
  const { token } = useParams();
  const [data, setData] = useState(undefined);
  const [err, setErr] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const audio = useRef(null);
  const track = useRef(null); // listen tracking for the current song

  useEffect(() => {
    fetch(`/api/share/view?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'This link isn’t available.'); return j; })
      .then(setData).catch((e) => { setErr(e.message); setData(null); });
  }, [token]);

  const songs = data?.songs || [];
  const cur = songs[idx];

  const report = useCallback((final) => {
    const t = track.current; if (!t || t.creating) return;
    const body = { t: token, songId: t.songId, versionId: t.vid, playId: t.id, listened: t.listened, duration: t.duration, bins: Array.from(t.bins).join(','), device: deviceName() };
    if (final && t.id && navigator.sendBeacon) { navigator.sendBeacon('/api/share/play', new Blob([JSON.stringify(body)], { type: 'application/json' })); return; }
    if (!t.id) t.creating = true;
    fetch('/api/share/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((j) => { if (j.id) t.id = j.id; }).catch(() => {}).finally(() => { t.creating = false; });
  }, [token]);

  useEffect(() => {
    if (!cur) return;
    const a = new Audio(); a.preload = 'auto'; a.src = cur.version.url; a.volume = 1;
    audio.current = a;
    track.current = { songId: cur.id, vid: cur.version.id, id: null, listened: 0, duration: cur.version.duration, bins: new Set(), last: 0, saved: 0 };
    const onMeta = () => setDur(a.duration || cur.version.duration || 0);
    const onEnd = () => { setPlaying(false); report(); if (idx < songs.length - 1) { setIdx(idx + 1); setTimeout(() => audio.current?.play().then(() => setPlaying(true)).catch(() => {}), 50); } };
    a.addEventListener('loadedmetadata', onMeta); a.addEventListener('ended', onEnd);
    let raf;
    const tick = () => {
      const t = track.current, now = performance.now();
      setTime(a.currentTime);
      if (!a.paused && t) {
        const d = a.duration || t.duration || 0; t.duration = d;
        if (t.last) t.listened += Math.min(1, (now - t.last) / 1000);
        if (d) t.bins.add(Math.min(BINS - 1, Math.floor((a.currentTime / d) * BINS)));
        if ((!t.id && t.listened > 1) || now - t.saved > 5000) { t.saved = now; report(); }
      }
      if (t) t.last = a.paused ? 0 : now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setTime(0); setDur(cur.version.duration || 0);
    return () => { cancelAnimationFrame(raf); a.pause(); a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('ended', onEnd); report(); audio.current = null; };
  }, [cur?.id]); // eslint-disable-line

  useEffect(() => {
    const bye = () => report(true);
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [report]);

  useEffect(() => { document.body.classList.toggle('playing', playing); return () => document.body.classList.remove('playing'); }, [playing]);

  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {}); else { a.pause(); setPlaying(false); } };
  const pick = (i) => {
    if (i === idx) return toggle();
    setIdx(i); setPlaying(false);
    setTimeout(() => audio.current?.play().then(() => setPlaying(true)).catch(() => {}), 50);
  };
  const seek = (t) => { const a = audio.current; if (a) { a.currentTime = t; setTime(t); } };
  useEffect(() => {
    const k = (e) => { if (e.code === 'Space' && !e.target.closest('input,textarea,button')) { e.preventDefault(); toggle(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });

  if (data === undefined) return <div className="boot"><img src="/logo.png" alt="" className="bootlogo" /></div>;
  if (!data) return (
    <main className="lpage lempty"><img src="/logo.png" alt="" className="llogo" /><h1 className="up">Link unavailable</h1><p className="muted">{err}</p></main>
  );

  const p = data.project, ar = data.artist;
  const artSrc = cur?.cover || p.cover, artSeed = cur?.seed ?? p.seed;
  const name = ar?.display_name || p.artist;
  return (
    <main className="lpage">
      <Art src={artSrc} seed={artSeed} size={200} className="lbg" />
      {ar?.header_url && <div className="lheader" style={{ backgroundImage: `url(${ar.header_url})` }} />}
      <div className="lwrap">
        <div className="ltop"><img src="/logo.png" alt="" className="llogo" /><span>CTRL ROOM</span></div>
        <div className="lmain">
          <div className="npdisc ldisc"><Art src={artSrc} seed={artSeed} size={640} className="npart spin" /><span className="nphole" />
            <button className="lhub" onClick={toggle} disabled={!cur} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          </div>
          <div className="linfo">
            <p className="leyebrow">{data.kind === 'song' ? `${p.title} · ${p.type}` : `${p.type}${p.release ? ` · ${new Date(p.release + 'T12:00').getFullYear()}` : ''}`}</p>
            <h1 className="up">{data.kind === 'song' ? cur?.title || 'Nothing to play yet' : p.title}</h1>
            <div className="lartist">{ar?.image_url && <img src={ar.image_url} alt="" />}<span>{name}</span>{cur && <QualityBadge v={cur.version} size="md" />}</div>
            {cur ? <>
              {data.kind === 'project' && <p className="lnow">{playing ? 'Playing' : 'Up'}: <b>{cur.title}</b></p>}
              <div><Wave peaks={cur.version.peaks} time={time} duration={dur} onSeek={seek} />
                <div className="nptimes mono"><span>{mmss(time)}</span><span>{cur.approved ? 'Final mix' : 'Mix in progress'}</span><span>{mmss(dur)}</span></div></div>
            </> : <p className="muted">There’s nothing to play here yet.</p>}
          </div>
        </div>
        {data.kind === 'project' && songs.length > 0 && (
          <ol className="ltracks">
            {songs.map((s, i) => (
              <li key={s.id}><button className={i === idx ? 'on' : ''} onClick={() => pick(i)}>
                <span className="mono ln">{i === idx && playing ? <span className="eq"><span /><span /><span /></span> : i + 1}</span>
                <span className="lt">{s.title}</span><span className="mono muted">{mmss(s.version.duration || 0)}</span>
              </button></li>
            ))}
          </ol>
        )}
        {cur && <LinkComments token={token} songId={cur.id} versionId={cur.version.id} time={time} seek={seek} />}
        {ar && (ar.bio || ar.spotify_url) && (
          <section className="labout">
            {ar.image_url && <img src={ar.image_url} alt="" />}
            <div><p className="leyebrow">About</p><h2 className="up">{name}</h2>{ar.bio && <p>{ar.bio}</p>}
              {ar.spotify_url && <a className="spbtn" href={ar.spotify_url} target="_blank" rel="noopener noreferrer"><SpotifyMark />Listen on Spotify</a>}</div>
          </section>
        )}
        <p className="lfoot">Shared privately with CTRL ROOM. Please don’t repost unreleased music.<br />Powered by <b>ARTHOUSE</b></p>
      </div>
    </main>
  );
}

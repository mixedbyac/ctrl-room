'use client';
import { makeArt } from '@/lib/art';
import Credit, { BlueCheck } from '@/components/Credit';
import QualityBadge from '@/components/QualityBadge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Cover from '@/components/Cover';
import { mmss, deviceName } from '@/lib/format';
import SpotifyMark from '@/components/SpotifyMark';
import LinkComments from '@/components/LinkComments';
import PoweredBy from '@/components/PoweredBy';

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
  const [ltab, setLtab] = useState('songs');
  const [data, setData] = useState(undefined);
  const [err, setErr] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mainGone, setMainGone] = useState(false); // big player scrolled away: show the mini bar
  const mainRef = useRef(null);
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
  useEffect(() => {
    const el = mainRef.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setMainGone(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el); return () => io.disconnect();
  }, [data]); // eslint-disable-line
  useEffect(() => { if (data && ltab === 'songs' && (data.kind === 'song' || songs.length < 2)) setLtab('progress'); }, [data]); // eslint-disable-line

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

  // lock screen / Control Center: cover art, title, artist and controls
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
    if (!ms || !cur || !data || typeof MediaMetadata === 'undefined') return;
    const src = cur.cover || data.project?.cover || (typeof document !== 'undefined' ? makeArt(cur.seed ?? data.project?.seed, 512) : '');
    ms.metadata = new MediaMetadata({ title: cur.title, artist: data.artist?.display_name || data.project?.artist || '', album: data.project?.title || 'CTRL ROOM',
      artwork: [{ src, sizes: '512x512', type: 'image/jpeg' }, { src: '/logo.png', sizes: '512x512', type: 'image/png' }] });
    const set = (k, fn) => { try { ms.setActionHandler(k, fn); } catch {} };
    set('play', () => audio.current?.play().then(() => setPlaying(true)).catch(() => {}));
    set('pause', () => { audio.current?.pause(); setPlaying(false); });
    set('nexttrack', idx < songs.length - 1 ? () => setIdx(idx + 1) : null);
    set('previoustrack', idx > 0 ? () => setIdx(idx - 1) : null);
    set('seekto', (d) => { if (audio.current && d?.seekTime != null) audio.current.currentTime = d.seekTime; });
  }, [cur?.id, data]); // eslint-disable-line
  useEffect(() => { try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch {} }, [playing]);

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
          <div className="npdisc ldisc" ref={mainRef}><Art src={artSrc} seed={artSeed} size={640} className="npart spin" /><span className="nphole" />
            <button className="lhub" onClick={toggle} disabled={!cur} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          </div>
          <div className="linfo">
            <p className="leyebrow">{data.kind === 'song' ? p.title : `${songs.length} song${songs.length === 1 ? '' : 's'}${p.release ? ` · ${new Date(p.release + 'T12:00').getFullYear()}` : ''}`}</p>
            <h1 className="ttl">{data.kind === 'song' ? cur?.title || 'Nothing to play yet' : p.title}</h1>
            <div className="lartist">{ar?.image_url && <img src={ar.image_url} alt="" />}<span>{name}</span>{cur && <QualityBadge v={cur.version} size="md" />}</div>
            {data.credit && (data.credit.profile ? <p className="lcredit"><Credit profile={data.credit.profile} /></p>
              : <p className="credit lcredit">{data.credit.photo && <img src={data.credit.photo} alt="" />}<span>{data.credit.text}</span>{data.credit.verified && <BlueCheck title="Verified engineer" />}</p>)}
            {cur ? <>
              {data.kind === 'project' && <p className="lnow">{playing ? 'Playing' : 'Up'}: <b>{cur.title}</b></p>}
              <div><Wave peaks={cur.version.peaks} time={time} duration={dur} onSeek={seek} />
                <div className="nptimes mono"><span>{mmss(time)}</span><span>{cur.approved ? 'Final mix' : 'Mix in progress'}</span><span>{mmss(dur)}</span></div></div>
            </> : <p className="muted">There’s nothing to play here yet.</p>}
          </div>
        </div>
        {cur && (
          <div className="npdtabs ltabs" role="tablist" aria-label="More about this song">
            {data.kind === 'project' && songs.length > 1 && <button role="tab" aria-selected={ltab === 'songs'} onClick={() => setLtab('songs')}>Songs</button>}
            <button role="tab" aria-selected={ltab === 'progress'} onClick={() => setLtab('progress')}>Progress</button>
            <button role="tab" aria-selected={ltab === 'details'} onClick={() => setLtab('details')}>Details</button>
          </div>
        )}
        {cur && ltab === 'progress' && (
          <ol className="npprog lprog">
            {[['Files received', cur.steps?.received], ['Mixing', cur.steps?.mixing], ['Ready to review', cur.steps?.review], ['Approved', cur.steps?.approved]].map(([k, d], i, all) => {
              const done = !!d, here = done && !all[i + 1]?.[1];
              return <li key={k} className={`${done ? 'done' : ''} ${here ? 'cur' : ''}`}><span className="npdot" /><b>{k}</b><span>{d ? new Date(`${String(d).slice(0, 10)}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span></li>;
            })}
          </ol>
        )}
        {cur && ltab === 'details' && (
          <dl className="npdetails ldetails">
            {[['Version', cur.version.label], ['Length', cur.version.duration ? mmss(cur.version.duration) : null], ['BPM', cur.bpm], ['Key', cur.key],
              ['Format', cur.version.file_format ? [cur.version.file_format, cur.version.sample_rate ? `${(cur.version.sample_rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '', cur.version.bit_depth ? `${cur.version.bit_depth}-bit` : ''].filter(Boolean).join(' · ') : null],
              ['Status', cur.approved ? 'Final mix' : 'Mix in progress'], ['Updated', cur.version.created_at ? new Date(cur.version.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null]]
              .filter(([, x]) => x != null && x !== '').map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x}</dd></div>)}
          </dl>
        )}
        {data.kind === 'project' && songs.length > 0 && (ltab === 'songs' || songs.length < 2) && ltab !== 'progress' && ltab !== 'details' && (
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
        <p className="lfoot">Shared privately with CTRL ROOM. Please don’t repost unreleased music.</p>
        <PoweredBy />
      </div>
      {cur && mainGone && (
        <div className={`lmini ${playing ? 'playing' : ''}`} role="region" aria-label="Now playing">
          <button className="lminiart" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to the player"><Art src={cur.cover || p.cover} seed={cur.seed ?? p.seed} size={120} className="lminiimg" /></button>
          <span className="lminit"><b>{cur.title}</b><span>{name}</span></span>
          <button className="lminibtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          {songs.length > 1 && idx < songs.length - 1 && <button className="lminibtn" onClick={() => pick(idx + 1)} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>}
          <span className="lminiprog" style={{ width: `${dur ? Math.min(100, (time / dur) * 100) : 0}%` }} />
        </div>
      )}
    </main>
  );
}

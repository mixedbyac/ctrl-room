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
import NoteComposer from '@/components/NoteComposer';
import { SongProgress, SongDetails } from '@/components/SongInfo';
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


const guestId = () => { try { let g = localStorage.getItem('ctrl-room:guest'); if (!g) { g = crypto.randomUUID?.() || String(Math.random()).slice(2); localStorage.setItem('ctrl-room:guest', g); } return g; } catch { return 'anon'; } };
const initials2 = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** The share link's full player that pops out of the mini player (like in the app): cover, waveform with comments, controls, a note box. */
function SharePlayer({ cur, p, name, artSrc, artSeed, playing, toggle, time, dur, seek, songs, idx, pick, token, canComment, startComposing, onClose }) {
  const [notes, setNotes] = useState([]);
  const [composing, setComposing] = useState(!!startComposing);
  const [pinAt, setPinAt] = useState(startComposing ? time : 0);
  const [body, setBody] = useState('');
  const [nm, setNm] = useState(() => { try { return localStorage.getItem('ctrl-room:guest-name') || ''; } catch { return ''; } });
  const [hadName] = useState(() => { try { return !!localStorage.getItem('ctrl-room:guest-name'); } catch { return false; } });
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('notes');
  const sheet = useRef(null), drag = useRef(null);
  const load = useCallback(() => {
    if (!canComment) return;
    fetch(`/api/share/notes?t=${encodeURIComponent(token)}&songId=${cur.id}&versionId=${cur.version.id}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setNotes((j.notes || []).filter((n) => !n.parent_id))).catch(() => {});
  }, [token, cur.id, cur.version.id, canComment]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [onClose]);
  // keep the note box above the phone keyboard, smoothly
  useEffect(() => {
    if (!composing) return;
    const vv = window.visualViewport; if (!vv) return;
    const fit = () => document.documentElement.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    requestAnimationFrame(() => sheet.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); document.documentElement.style.setProperty('--kb', '0px'); };
  }, [composing]);
  const timed = notes.filter((n) => n.t != null).sort((a, b) => a.t - b.t);
  const active = [...timed].reverse().find((n) => time >= n.t && time - n.t < 4.5) || null;
  const post = async (text, at) => {
    if (!text?.trim()) return false;
    if (!nm.trim()) { setMsg('Add your name first.'); return false; }
    try { localStorage.setItem('ctrl-room:guest-name', nm.trim()); } catch {}
    const r = await fetch('/api/share/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, songId: cur.id, versionId: cur.version.id, guestId: guestId(), name: nm.trim(), action: 'post', body: text, at }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Couldn’t post that.'); return false; }
    setComposing(false); setMsg(at == null ? 'General note posted.' : `Posted at ${mmss(at)}.`); setTimeout(() => setMsg(''), 2500);
    load(); window.dispatchEvent(new Event('ctrl-room:link-notes'));
  };
  return (
    <>
      <div className="npscrim" onClick={onClose} aria-hidden="true" />
      <div className={`np sharenp ${composing ? 'composing' : ''}`} role="dialog" aria-label="Now playing" ref={sheet}
        onTouchStart={(e) => { const el = sheet.current; if (!el || el.scrollTop > 0 || e.target.closest('.npwave, textarea, input')) return; drag.current = { y: e.touches[0].clientY, dy: 0 }; }}
        onTouchMove={(e) => { const d = drag.current; if (!d) return; d.dy = Math.max(0, e.touches[0].clientY - d.y); if (d.dy > 4) { sheet.current.style.transition = 'none'; sheet.current.style.transform = `translateY(${d.dy}px)`; } }}
        onTouchEnd={() => { const d = drag.current; drag.current = null; if (!d || !sheet.current) return; const el = sheet.current; el.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; if (d.dy > 110) { el.style.transform = 'translateY(100%)'; setTimeout(onClose, 220); } else el.style.transform = ''; }}>
        <span className="npgrab" aria-hidden="true" />
        <div className="npinner">
          <div className="nptop">
            <span className="npfrom">Playing from <b>{p.title}</b></span>
            <button className="npclose" onClick={onClose} aria-label="Close the player"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
          </div>
          <Art src={artSrc} seed={artSeed} size={900} className="npsquare sharesquare" />
          <div className="nphead">
            <div className="nphead-t"><h2 className="ttl">{cur.title}</h2><p className="npsub">{name} · {p.title}</p></div>
            {canComment && <button className="npcomment" onClick={() => { setPinAt(time); setComposing(true); }} aria-label="Add a comment at this moment">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M12 8.5v4M10 10.5h4" /></svg><span>Comment</span></button>}
          </div>
          <div>
            <div className="npwavewrap">
              <Wave peaks={cur.version.peaks} time={time} duration={dur} onSeek={seek} />
              {composing && pinAt != null && dur > 0 && <span className="nppin" style={{ left: `${Math.min(100, (pinAt / dur) * 100)}%` }} aria-hidden="true" />}
              {dur > 0 && timed.map((n) => <button key={n.id} className={`npmark ${active?.id === n.id ? 'on' : ''}`} style={{ left: `${Math.min(100, (n.t / dur) * 100)}%` }} onClick={() => seek(n.t)} aria-label={`${n.author_name || 'Note'} at ${mmss(n.t)}`}><span>{initials2(n.author_name)}</span></button>)}
              {active && !composing && dur > 0 && <span className="npbubble" key={active.id} style={{ '--x': `${Math.min(100, (active.t / dur) * 100)}%` }}><b>{active.author_name || 'Listener'}</b> {active.body}</span>}
            </div>
            <div className="nptimes mono"><span>{mmss(time)}</span><span className="npfmt">{cur.approved ? 'Final mix' : 'Mix in progress'}</span><span className="npdur">{mmss(dur)}</span><span className="npleft">-{mmss(Math.max(0, dur - time))}</span></div>
          </div>
          {composing && (
            <NoteComposer now={time} start={pinAt} duration={dur} label={`On ${cur.version.label}`} onAt={(t) => setPinAt(t)} onCancel={() => setComposing(false)} onPost={(b, at) => post(b, at)}
              nameField={!hadName ? <input className="lqname" placeholder="Your name" value={nm} onChange={(e) => setNm(e.target.value)} maxLength={40} aria-label="Your name" /> : null} />
          )}
          {msg && <p className="npposted" role="status">{msg}</p>}
          <div className="npctl">
            <button className="npskip" onClick={() => seek(Math.max(0, time - 15))} aria-label="Back 15 seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 103-6.7L3 8" /><path d="M3 3v5h5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">15</text></svg></button>
            <button onClick={() => idx > 0 && pick(idx - 1)} disabled={idx === 0} aria-label="Previous song"><svg viewBox="0 0 24 24"><path d="M11 12l9-6.5v13zM2 12l9-6.5v13z" /></svg></button>
            <button className="npplay" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
            <button onClick={() => idx < songs.length - 1 && pick(idx + 1)} disabled={idx >= songs.length - 1} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>
            <button className="npskip" onClick={() => seek(Math.min(dur || 0, time + 15))} aria-label="Forward 15 seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">15</text></svg></button>
          </div>
          <div className="npdeck">
            <div className="npdtabs" role="tablist">
              {songs.length > 1 && <button role="tab" aria-selected={tab === 'songs'} onClick={() => setTab('songs')}>Playlist</button>}
              {canComment && <button role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>Notes{notes.length ? <i>{notes.length}</i> : null}</button>}
              <button role="tab" aria-selected={tab === 'progress' || (!canComment && tab === 'notes')} onClick={() => setTab('progress')}>Progress</button>
              <button role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>Details</button>
            </div>
            {tab === 'songs' && songs.length > 1 && <div className="npq">{songs.map((x, i) => <button key={x.id} className={`npqi ${i === idx ? 'on' : ''}`} onClick={() => pick(i)}><span className="npqn mono">{i + 1}</span><Art src={x.cover || p.cover} seed={x.seed ?? p.seed} size={80} className="" /><span className="npqt">{x.title}</span>{i === idx && playing && <span className="eq"><span /><span /><span /></span>}</button>)}</div>}
            {tab === 'notes' && canComment && <div className="npnotes">{timed.length ? timed.map((n) => <button key={n.id} className="npnote" onClick={() => seek(n.t)}><span className="npnt mono">{mmss(n.t)}</span><span className="npnb"><b>{n.author_name || 'Listener'}</b><span>{n.body}</span></span></button>) : <p className="npempty">No notes yet. Tap Comment at the moment you hear something.</p>}</div>}
            {(tab === 'progress' || (!canComment && tab === 'notes')) && <SongProgress steps={cur.steps || {}} />}
            {tab === 'details' && <SongDetails rows={[['Version', cur.version.label], ['Length', cur.version.duration ? mmss(cur.version.duration) : null], ['BPM', cur.bpm], ['Key', cur.key], ['Status', cur.approved ? 'Final mix' : 'Mix in progress']]} />}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SharedListen() {
  const { token } = useParams();
  const [ltab, setLtab] = useState('progress');
  const [data, setData] = useState(undefined);
  const [err, setErr] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mainGone, setMainGone] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [quick, setQuick] = useState(null); // phone mini player comment: { at, body, name }
  const [quickMsg, setQuickMsg] = useState('');
  useEffect(() => { const on = (e) => setCanComment(!!e.detail?.enabled); window.addEventListener('ctrl-room:link-comments', on); return () => window.removeEventListener('ctrl-room:link-comments', on); }, []);
  const [allSongs, setAllSongs] = useState(false);
  const [big, setBig] = useState(null); // the popped-out player: { compose: bool }
  const openQuick = (at) => setQuick({ at, body: '', name: (() => { try { return localStorage.getItem('ctrl-room:guest-name') || ''; } catch { return ''; } })() }); // long projects: show the first few songs so comments stay close // big player scrolled away: show the mini bar
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
    let lastSet = 0;
    const tick = () => {
      const t = track.current, now = performance.now();
      // update the screen ~5 times a second (every frame made phones too busy to respond to taps)
      if (now - lastSet > 200 || a.paused) { lastSet = now; setTime((prev) => (Math.abs(prev - a.currentTime) > 0.05 ? a.currentTime : prev)); }
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
              : <p className="credit lcredit">{data.credit.photo && <img src={data.credit.photo} alt="" />}<span>{data.credit.text}</span>{data.credit.verified && <BlueCheck kind="engineer" />}</p>)}
            {cur ? <>
              {data.kind === 'project' && <p className="lnow">{playing ? 'Playing' : 'Up'}: <b>{cur.title}</b></p>}
              <div><Wave peaks={cur.version.peaks} time={time} duration={dur} onSeek={seek} />
                <div className="nptimes mono"><span>{mmss(time)}</span><span>{cur.approved ? 'Final mix' : 'Mix in progress'}</span><span>{mmss(dur)}</span></div></div>
              {canComment && <button className="lcommentbtn" onClick={() => { if (!playing) toggle(); setBig({ compose: true }); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>Comment at {mmss(time)}</button>}
            </> : <p className="muted">There’s nothing to play here yet.</p>}
              {data.kind === 'project' && songs.length > 1 && (
                <ol className="ltracks">
                  {songs.map((s, i) => (allSongs || songs.length <= 7 || i < 6 || i === idx) && (
                    <li key={s.id}><button className={`${i === idx ? 'on' : ''} ${i === idx && playing ? 'live' : ''}`} onClick={() => pick(i)} aria-label={i === idx && playing ? `Pause ${s.title}` : `Play ${s.title}`}>
                      <span className="mono ln"><span className="lnum">{i + 1}</span><svg viewBox="0 0 24 24" aria-hidden="true">{i === idx && playing ? PAUSE : PLAY}</svg></span>
                      <span className="lt">{s.title}{s.approved && <em className="lfinal">Final</em>}</span>
                      {canComment && <span className="lrowc" role="button" tabIndex={0} aria-label={`Comment on ${s.title}`} title="Comment on this song"
                        onClick={(e) => { e.stopPropagation(); if (i !== idx) pick(i); else if (!playing) toggle(); setBig({ compose: true }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); e.currentTarget.click(); } }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg></span>}
                      <span className="mono muted">{mmss(s.version.duration || 0)}</span>
                    </button></li>
                  ))}
                </ol>
              )}
              {data.kind === 'project' && songs.length > 7 && (
                <button className="lshowall" onClick={() => setAllSongs(!allSongs)}>{allSongs ? 'Show fewer' : `Show all ${songs.length} songs`}</button>
              )}
          </div>
        </div>
        {cur && <LinkComments token={token} songId={cur.id} versionId={cur.version.id} time={time} seek={seek} />}
        {cur && (
          <div className="npdtabs ltabs" role="tablist" aria-label="More about this song">
            <button role="tab" aria-selected={ltab === 'progress'} onClick={() => setLtab('progress')}>Progress</button>
            <button role="tab" aria-selected={ltab === 'details'} onClick={() => setLtab('details')}>Details</button>
          </div>
        )}
        {cur && ltab === 'progress' && <div className="lprog"><SongProgress steps={cur.steps || {}} /></div>}
        {cur && ltab === 'details' && <div className="ldetails"><SongDetails rows={[['Version', cur.version.label], ['Length', cur.version.duration ? mmss(cur.version.duration) : null], ['BPM', cur.bpm], ['Key', cur.key],
          ['Format', cur.version.file_format ? [cur.version.file_format, cur.version.sample_rate ? `${(cur.version.sample_rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '', cur.version.bit_depth ? `${cur.version.bit_depth}-bit` : ''].filter(Boolean).join(' · ') : null],
          ['Status', cur.approved ? 'Final mix' : 'Mix in progress'], ['Updated', cur.version.created_at ? new Date(cur.version.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null]]} /></div>}
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
      {cur && (mainGone || quick) && !big && (
        <div className={`lmini ${playing ? 'playing' : ''}`} role="region" aria-label="Now playing">
          <button className="lminiart" onClick={() => setBig({ compose: false })} aria-label="Open the player"><Art src={cur.cover || p.cover} seed={cur.seed ?? p.seed} size={120} className="lminiimg" /></button>
          <button className="lminit" onClick={() => setBig({ compose: false })}><b>{cur.title}</b><span>{name}</span></button>
          <button className="lminibtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          {canComment && <button className={`lminibtn ${quick ? 'on' : ''}`} onClick={() => setBig({ compose: true })} aria-label="Comment at this moment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: 'none' }}><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg></button>}
          {songs.length > 1 && idx < songs.length - 1 && <button className="lminibtn" onClick={() => pick(idx + 1)} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>}
          <span className="lminiprog" style={{ width: `${dur ? Math.min(100, (time / dur) * 100) : 0}%` }} />
        </div>
      )}
      {cur && quick && (
        <div className="lquick" role="dialog" aria-label={`Comment on ${cur.title}`}>
          {!quick.name && <input className="lqname" placeholder="Your name" value={quick.nameDraft || ''} onChange={(e) => setQuick({ ...quick, nameDraft: e.target.value })} maxLength={40} aria-label="Your name" />}
          <div className="lqrow">
            <button className="nc-time mono" onClick={() => setQuick({ ...quick, at: time })} title="Tap to use right now">{mmss(quick.at)}</button>
            <textarea rows={1} autoFocus placeholder={`Note on ${cur.title}…`} value={quick.body} onChange={(e) => setQuick({ ...quick, body: e.target.value })} aria-label="Comment" enterKeyHint="send"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('lqsend')?.click(); } }} />
            <button id="lqsend" className="nc-send" disabled={!quick.body.trim()} aria-label="Post" onClick={async () => {
              const nm = (quick.name || quick.nameDraft || '').trim();
              if (!nm) return setQuickMsg('Add your name first.');
              try { localStorage.setItem('ctrl-room:guest-name', nm); } catch {}
              let g = ''; try { g = localStorage.getItem('ctrl-room:guest') || ''; if (!g) { g = crypto.randomUUID?.() || String(Math.random()).slice(2); localStorage.setItem('ctrl-room:guest', g); } } catch {}
              const r = await fetch('/api/share/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, songId: cur.id, versionId: cur.version.id, guestId: g, name: nm, action: 'post', body: quick.body, at: quick.at }) });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) return setQuickMsg(j.error || 'Couldn’t post that.');
              setQuick(null); setQuickMsg(`Posted at ${mmss(quick.at)}.`); setTimeout(() => setQuickMsg(''), 2500);
              window.dispatchEvent(new Event('ctrl-room:link-notes'));
            }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
          </div>
          {quickMsg && <p className="lqmsg">{quickMsg}</p>}
        </div>
      )}
      {quickMsg && !quick && mainGone && <p className="lqtoast" role="status">{quickMsg}</p>}
      {cur && big && <SharePlayer key={`${cur.id}-${big.compose}`} cur={cur} p={p} name={name} artSrc={artSrc} artSeed={artSeed} playing={playing} toggle={toggle} time={time} dur={dur} seek={seek}
        songs={songs} idx={idx} pick={pick} token={token} canComment={canComment} startComposing={big.compose} onClose={() => setBig(null)} />}
    </main>
  );
}

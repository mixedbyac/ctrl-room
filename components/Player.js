'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';
import { mmss, deviceName, orderVersions, latestMix } from '@/lib/format';
import { artOf } from '@/lib/art';

/*
  One player for the whole app. It lives above the pages, so music keeps playing while you move around.
  Files play exactly as uploaded: a plain <audio> element at full volume, no processing.
*/
const Ctx = createContext(null);
export const usePlayer = () => useContext(Ctx);
const BINS = 100;

export function PlayerProvider({ eng, children }) {
  const audios = useRef({});           // versionId -> HTMLAudioElement
  const urls = useRef({});             // storage_path -> { url, exp }
  const [current, setCurrent] = useState(null); // { song, project, versions, versionId }
  const [queue, setQueue] = useState([]);       // song ids, in order
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // when a cover changes anywhere, the mini player and Now Playing change with it
  useEffect(() => {
    const on = (e) => {
      const { table, id, patch } = e.detail || {};
      setCurrent((c) => {
        if (!c) return c;
        let next = c;
        if (table === 'songs' && c.song?.id === id) next = { ...c, song: { ...c.song, ...patch } };
        if (table === 'projects' && c.project?.id === id) next = { ...c, project: { ...c.project, ...patch } };
        if (next !== c) curRef.current = next;
        return next;
      });
    };
    window.addEventListener('ctrl-room:cover', on);
    return () => window.removeEventListener('ctrl-room:cover', on);
  }, []);
  const curRef = useRef(null);
  curRef.current = current;

  const signed = useCallback(async (paths) => {
    const now = Date.now(), need = paths.filter((p) => !urls.current[p] || urls.current[p].exp < now + 60_000);
    if (need.length) {
      // short-lived play links: they only work for people on the project, and expire after 2 hours
      const { data } = await supabase().storage.from('mixes').createSignedUrls(need, 2 * 3600);
      (data || []).forEach((x, i) => { if (x.signedUrl) urls.current[need[i]] = { url: x.signedUrl, exp: now + 2 * 3600 * 1000 }; });
    }
  }, []);

  const audioFor = useCallback((v) => {
    if (!v) return null;
    let a = audios.current[v.id];
    if (!a) {
      const u = urls.current[v.storage_path]?.url;
      if (!u) return null;
      a = new Audio();
      a.preload = 'auto';
      a.volume = 1;
      a.src = u;
      a.addEventListener('ended', () => { if (curRef.current?.versionId === v.id) { setPlaying(false); nextRef.current?.(true); } });
      a.addEventListener('loadedmetadata', () => { if (curRef.current?.versionId === v.id) setDuration(a.duration || 0); });
      // link expired (left paused a long time): get a fresh one and carry on from the same spot
      a.addEventListener('error', async () => {
        if (a._renewing) return;
        a._renewing = true;
        const at = a.currentTime || 0, wasOn = curRef.current?.versionId === v.id;
        delete urls.current[v.storage_path];
        await signed([v.storage_path]);
        const fresh = urls.current[v.storage_path]?.url;
        if (fresh) { a.src = fresh; a.addEventListener('loadedmetadata', () => { try { a.currentTime = at; } catch {} if (wasOn) a.play().catch(() => {}); a._renewing = false; }, { once: true }); }
      });
      audios.current[v.id] = a;
    }
    return a;
  }, []);

  const curAudio = () => {
    const c = curRef.current;
    return c ? audios.current[c.versionId] || audioFor(c.versions.find((v) => v.id === c.versionId)) : null;
  };

  const stopAll = () => Object.values(audios.current).forEach((a) => a.pause());

  /** Load a song (by id or object) and play it. */
  const play = useCallback(async ({ songId, song, project, versions, versionId, at = 0, queue: q, autoplay = true }) => {
    const sb = supabase();
    let s = song, p = project, vs = versions;
    const id = songId || s?.id;
    if (!s || !p) {
      const { data } = await sb.from('songs').select('*, projects(*)').eq('id', id).single();
      if (!data) return;
      s = data; p = data.projects;
    }
    if (!vs) {
      const { data } = await sb.from('versions').select('*').eq('song_id', id).order('created_at');
      vs = data || [];
    }
    vs = orderVersions(vs);
    if (!vs.length) return;
    await signed(vs.map((v) => v.storage_path));
    const v = vs.find((x) => x.id === versionId) || latestMix(vs) || vs[vs.length - 1];
    stopAll();
    const next = { song: s, project: p, versions: vs, versionId: v.id };
    curRef.current = next;
    setCurrent(next);
    if (q) setQueue(q);
    const a = audioFor(v);
    if (!a) return;
    setDuration(a.duration || v.duration || 0);
    const go = () => { try { a.currentTime = at || 0; } catch {} setTime(at || 0); if (autoplay) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  }, [audioFor, signed]);

  const pause = useCallback(() => { const a = curAudio(); if (a) a.pause(); setPlaying(false); }, []); // eslint-disable-line
  const resume = useCallback(() => { const a = curAudio(); if (a) a.play().then(() => setPlaying(true)).catch(() => {}); }, []); // eslint-disable-line
  const toggle = useCallback(() => (playing ? pause() : resume()), [playing, pause, resume]);
  const seek = useCallback((t) => { const a = curAudio(); if (a) { a.currentTime = Math.max(0, Math.min(t, a.duration || t)); setTime(a.currentTime); } }, []); // eslint-disable-line

  /** Same song, different version, same spot in the song. */
  const switchVersion = useCallback(async (versionId) => {
    const c = curRef.current;
    if (!c || versionId === c.versionId) return;
    const v = c.versions.find((x) => x.id === versionId);
    if (!v) return;
    const old = curAudio(), t = old ? old.currentTime : 0, was = playing;
    if (old) old.pause();
    await signed([v.storage_path]);
    const next = { ...c, versionId };
    curRef.current = next;
    setCurrent(next);
    const b = audioFor(v);
    if (!b) return;
    const go = () => { try { b.currentTime = Math.min(t, b.duration || t); } catch {} setDuration(b.duration || 0); if (was) b.play().catch(() => {}); };
    if (b.readyState >= 1) go(); else b.addEventListener('loadedmetadata', go, { once: true });
  }, [playing, audioFor, signed]); // eslint-disable-line

  /** Refresh the current song's versions (after a delivery or rename) without stopping. */
  const refresh = useCallback((songId, versions) => {
    const c = curRef.current;
    if (!c || c.song.id !== songId) return;
    signed(versions.map((v) => v.storage_path)).then(() => {
      const next = { ...c, versions };
      curRef.current = next;
      setCurrent(next);
    });
  }, [signed]);

  const step = useCallback(async (dir, auto = false) => {
    const c = curRef.current;
    if (!c) return;
    if (dir < 0) { const a = curAudio(); if (a && a.currentTime > 3) { seek(0); return; } }
    const ids = queue.length ? queue : [c.song.id];
    const i = ids.indexOf(c.song.id);
    const to = ids[i + dir];
    if (!to) { if (auto) setPlaying(false); return; }
    await play({ songId: to, queue: ids });
  }, [queue, play, seek]); // eslint-disable-line
  const nextRef = useRef(null);
  nextRef.current = (auto) => step(1, auto);

  /* frame loop: time, turntable, listen tracking */
  const rot = useRef({ angle: 0, vel: 0, last: 0, lastSet: 0 });
  const track = useRef(null);
  useEffect(() => {
    let raf;
    const loop = (ts) => {
      const r = rot.current, dt = Math.min(0.05, (ts - (r.last || ts)) / 1000); r.last = ts;
      const a = curAudio();
      if (a && playing && ts - r.lastSet > 80) { r.lastSet = ts; setTime(a.currentTime); }
      const target = playing ? 1 : 0;
      r.vel += (target - r.vel) * (target > r.vel ? 2.2 : 1.1) * dt;
      if (Math.abs(r.vel) > 0.001) { r.angle = (r.angle + r.vel * 200 * dt) % 360; document.body.style.setProperty('--rot', r.angle.toFixed(2) + 'deg'); }
      if (!eng && a && playing && a.duration) listen(a);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  useEffect(() => { document.body.classList.toggle('playing', playing); }, [playing]);

  function listen(a) {
    const c = curRef.current;
    let t = track.current;
    if (!t || t.vid !== c.versionId) t = track.current = { vid: c.versionId, songId: c.song.id, bins: new Uint8Array(BINS), last: null, rowId: null, creating: false, savedAt: 0 };
    const d = a.duration, pos = a.currentTime, b = Math.min(BINS - 1, Math.floor((pos / d) * BINS));
    if (t.last != null && pos >= t.last && pos - t.last < 1 && t.lastBin !== b) t.bins[b] = Math.min(255, t.bins[b] + 1);
    t.lastBin = b; t.last = pos;
    const listened = (t.bins.reduce((n, x) => n + (x ? 1 : 0), 0) / BINS) * d, now = Date.now();
    if (!t.rowId && !t.creating) {
      t.creating = true;
      const from = new URLSearchParams(window.location.search).get('from');
      supabase().from('plays').insert({ song_id: t.songId, version_id: t.vid, device: deviceName(), source: from === 'text' ? 'from your text' : 'in CTRL ROOM', duration: d, listened: 0 })
        .select('id').single().then(({ data }) => { if (data) t.rowId = data.id; t.creating = false; });
    } else if (t.rowId && now - t.savedAt > 5000) {
      t.savedAt = now;
      supabase().from('plays').update({ listened, duration: d, bins: Array.from(t.bins).join(','), updated_at: new Date().toISOString() }).eq('id', t.rowId).then(() => {});
    }
  }

  // space bar plays/pauses anywhere (pages can still handle their own keys)
  useEffect(() => {
    const k = (e) => {
      if (e.code !== 'Space' || e.target.closest('textarea,input,select,button,[contenteditable]') || !curRef.current) return;
      e.preventDefault(); toggle();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [toggle]);

  useEffect(() => () => { Object.values(audios.current).forEach((a) => { a.pause(); a.src = ''; }); }, []);

  const version = current ? current.versions.find((v) => v.id === current.versionId) : null;
  const value = { current, version, queue, playing, time, expanded, setExpanded, duration: duration || version?.duration || 0, play, pause, resume, toggle, seek, switchVersion, refresh, next: () => step(1), prev: () => step(-1) };
  return <Ctx.Provider value={value}>{children}<MiniPlayer />{expanded && current && <NowPlaying />}</Ctx.Provider>;
}

const PLAY = <path d="M7 4.5v15l13-7.5z" />;
const PAUSE = <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />;

function MiniPlayer() {
  const pl = usePlayer();
  const cv = useRef(null), wrap = useRef(null);
  const c = pl.current, v = pl.version;
  useEffect(() => {
    const el = cv.current; if (!el) return;
    const r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (!W || !H) return;
    if (el.width !== W || el.height !== H) { el.width = W; el.height = H; }
    const g = el.getContext('2d'); g.clearRect(0, 0, W, H);
    const pk = v?.peaks, step = 3 * dpr, n = Math.floor(W / step), prog = pl.duration ? pl.time / pl.duration : 0;
    for (let i = 0; i < n; i++) {
      let p = 0.08;
      if (pk?.length) { const a = Math.floor((i / n) * pk.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * pk.length)); p = 0; for (let j = a; j < b; j++) p = Math.max(p, pk[j] || 0); }
      const h = Math.max(2 * dpr, Math.min(1, p) * H * 0.95);
      g.fillStyle = i / n < prog ? '#f4f4f5' : '#47474d';
      g.fillRect(i * step, (H - h) / 2, 1.5 * dpr, h);
    }
    g.fillStyle = '#f5d547'; g.fillRect(Math.round(prog * W) - dpr, 0, 2 * dpr, H);
  });
  if (!c || !v) return null;
  const seekAt = (e) => { const r = wrap.current.getBoundingClientRect(); pl.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * pl.duration); };
  const i = pl.queue.indexOf(c.song.id);
  return (
    <div className="mini">
      <div className="minibar">
        <button className="mopen" onClick={() => pl.setExpanded(!pl.expanded)} aria-label={`Open the player for ${c.song.title}`}><Cover as="div" {...artOf(c.song, c.project)} size={120} className="mart spin" /></button>
        <button className="mtext" onClick={() => pl.setExpanded(!pl.expanded)}>
          <b><span id="mtitle">{c.song.title}</span>{pl.playing && <span className="eq"><span /><span /><span /></span>}</b>
          <span>{c.project.title} · {v.label}</span>
        </button>
        <div className="mwave" ref={wrap} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekAt(e); }} onPointerMove={(e) => { if (e.buttons) seekAt(e); }}><canvas ref={cv} /></div>
        <span className="mtime mono">{mmss(pl.time)} / {mmss(pl.duration)}</span>
        <div className="mctl">
          <button onClick={pl.prev} aria-label="Previous song"><svg viewBox="0 0 24 24"><path d="M11 12l9-6.5v13zM2 12l9-6.5v13z" /></svg></button>
          <button className="mp" onClick={pl.toggle} aria-label={pl.playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{pl.playing ? PAUSE : PLAY}</svg></button>
          <button onClick={pl.next} disabled={i < 0 || i >= pl.queue.length - 1} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>
          <button onClick={() => pl.setExpanded(!pl.expanded)} aria-label={pl.expanded ? 'Close the player' : 'Open the player'} aria-expanded={pl.expanded} className={`mexp ${pl.expanded ? 'on' : ''}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- full-screen Now Playing ---------- */
function Wave({ peaks, time, duration, onSeek, height = 72 }) {
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
    g.fillStyle = '#f5d547'; g.fillRect(Math.round(prog * W) - dpr, 0, 2 * dpr, H);
  });
  const at = (e) => { const r = wrap.current.getBoundingClientRect(); onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration); };
  return (
    <div ref={wrap} className="npwave" style={{ height }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }} onPointerMove={(e) => { if (e.buttons) at(e); }}>
      <canvas ref={cv} />
    </div>
  );
}

function NowPlaying() {
  const pl = usePlayer();
  const c = pl.current, v = pl.version;
  const [upNext, setUpNext] = useState([]);
  const close = () => pl.setExpanded(false);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') close();
      if ((e.key === 'x' || e.key === 'X') && !e.target.closest('input,textarea,select') && c.versions.length > 1) flip();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  useEffect(() => {
    const ids = pl.queue.length ? pl.queue : [c.song.id];
    supabase().from('songs').select('id,title,seed,cover_path,status').in('id', ids).then(({ data }) => {
      const byId = Object.fromEntries((data || []).map((x) => [x.id, x]));
      setUpNext(ids.map((id) => byId[id]).filter(Boolean));
    });
  }, [pl.queue.join(','), c.song.id]); // eslint-disable-line
  const vi = c.versions.findIndex((x) => x.id === c.versionId);
  const flip = () => { const prev = c.versions[vi - 1] || c.versions[vi + 1]; if (prev) pl.switchVersion(prev.id); };
  return (
    <>
    <div className="npscrim" onClick={close} aria-hidden="true" />
    <div className="np" role="dialog" aria-label="Now playing">
      <Cover as="div" {...artOf(c.song, c.project)} size={240} className="npbg" />
      <div className="npinner">
        <div className="nptop">
          <span className="npfrom">Playing from <b>{c.project.title}</b></span>
          <Link className="npopen" href={`/s/${c.song.id}`} onClick={close}>Notes &amp; details</Link>
          <button className="npclose" onClick={close} aria-label="Close the player"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
        </div>
        <div className="npdisc"><Cover as="div" {...artOf(c.song, c.project)} size={640} className="npart spin" /><span className="nphole" /></div>
        <div className="nphead">
          <h2 className="up">{c.song.title}</h2>
          <p className="npsub">{c.project.artist} · {c.project.title}</p>
        </div>
        {c.versions.length > 1 && (
          <div className="npvers" role="group" aria-label="Versions">
            {c.versions.map((x) => <button key={x.id} aria-pressed={x.id === c.versionId} onClick={() => pl.switchVersion(x.id)}>{x.label}</button>)}
            <span className="nphint">keeps your spot</span>
          </div>
        )}
        <div>
          <Wave peaks={v?.peaks} time={pl.time} duration={pl.duration} onSeek={pl.seek} height={52} />
          <div className="nptimes mono"><span>{mmss(pl.time)}</span><span>{v?.file_format ? `${v.file_format}${v.bit_depth ? ` · ${Math.abs(v.bit_depth)}-bit` : ''}${v.sample_rate ? ` · ${(v.sample_rate / 1000).toFixed(v.sample_rate % 1000 ? 1 : 0)} kHz` : ''}` : 'Original file'}</span><span>{mmss(pl.duration)}</span></div>
        </div>
        <div className="npctl">
          <button onClick={pl.prev} aria-label="Previous song"><svg viewBox="0 0 24 24"><path d="M11 12l9-6.5v13zM2 12l9-6.5v13z" /></svg></button>
          <button className="npplay" onClick={pl.toggle} aria-label={pl.playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{pl.playing ? PAUSE : PLAY}</svg></button>
          <button onClick={pl.next} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>
        </div>
        {upNext.length > 1 && (
          <div className="npqueue">
            <p className="nplabel">Up next</p>
            <div className="npq">
              {upNext.map((s, n) => (
                <button key={s.id} className={`npqi ${s.id === c.song.id ? 'on' : ''}`} onClick={() => (s.id === c.song.id ? pl.toggle() : pl.play({ songId: s.id, queue: pl.queue }))}>
                  <span className="npqn mono">{n + 1}</span>
                  <Cover {...artOf(s, c.project)} size={80} />
                  <span className="npqt">{s.title}</span>
                  {s.id === c.song.id && pl.playing && <span className="eq"><span /><span /><span /></span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

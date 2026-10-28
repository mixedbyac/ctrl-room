'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';
import { mmss, deviceName } from '@/lib/format';

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
  const curRef = useRef(null);
  curRef.current = current;

  const signed = useCallback(async (paths) => {
    const now = Date.now(), need = paths.filter((p) => !urls.current[p] || urls.current[p].exp < now + 60_000);
    if (need.length) {
      const { data } = await supabase().storage.from('mixes').createSignedUrls(need, 6 * 3600);
      (data || []).forEach((x, i) => { if (x.signedUrl) urls.current[need[i]] = { url: x.signedUrl, exp: now + 6 * 3600 * 1000 }; });
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
    if (!vs.length) return;
    await signed(vs.map((v) => v.storage_path));
    const v = vs.find((x) => x.id === versionId) || vs[vs.length - 1];
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
      supabase().from('plays').insert({ song_id: t.songId, version_id: t.vid, device: deviceName(), source: from === 'text' ? 'from your text' : 'in Ctrl Room', duration: d, listened: 0 })
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
  const value = { current, version, queue, playing, time, duration: duration || version?.duration || 0, play, pause, resume, toggle, seek, switchVersion, refresh, next: () => step(1), prev: () => step(-1) };
  return <Ctx.Provider value={value}>{children}<MiniPlayer /></Ctx.Provider>;
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
        <Link href={`/s/${c.song.id}`} aria-label={`Open ${c.song.title}`}><Cover as="div" seed={c.song.seed} path={c.song.cover_path || c.project.cover_path} size={120} className="mart spin" /></Link>
        <Link className="mtext" href={`/s/${c.song.id}`}>
          <b><span id="mtitle">{c.song.title}</span>{pl.playing && <span className="eq"><span /><span /><span /></span>}</b>
          <span>{c.project.title} · {v.label}</span>
        </Link>
        <div className="mwave" ref={wrap} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekAt(e); }} onPointerMove={(e) => { if (e.buttons) seekAt(e); }}><canvas ref={cv} /></div>
        <span className="mtime mono">{mmss(pl.time)} / {mmss(pl.duration)}</span>
        <div className="mctl">
          <button onClick={pl.prev} aria-label="Previous song"><svg viewBox="0 0 24 24"><path d="M11 12l9-6.5v13zM2 12l9-6.5v13z" /></svg></button>
          <button className="mp" onClick={pl.toggle} aria-label={pl.playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{pl.playing ? PAUSE : PLAY}</svg></button>
          <button onClick={pl.next} disabled={i < 0 || i >= pl.queue.length - 1} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>
        </div>
      </div>
    </div>
  );
}

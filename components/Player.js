'use client';
import ArtistName from '@/components/ArtistName';
import Credit from '@/components/Credit';
import NoteComposer from '@/components/NoteComposer';
import { SongProgress, SongDetails } from '@/components/SongInfo';
import QualityBadge from '@/components/QualityBadge';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';
import { mmss, deviceName, orderVersions, latestMix, currentMix } from '@/lib/format';
import { makeArt, artOf } from '@/lib/art';

/** Save one mix version to the computer/phone, named “Song v3.wav”. */
export async function downloadVersion(song, v) {
  const name = `${song.title} ${v.label}${(v.file_name || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || ''}`;
  const { data, error } = await supabase().storage.from('mixes').createSignedUrl(v.storage_path, 300, { download: name });
  if (error) return window.alert?.(error.message);
  const a = document.createElement('a'); a.href = data.signedUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

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
  const [composeReq, setComposeReq] = useState(0); // bump to open Now Playing with the comment box up
  const wantCompose = useRef(false);
  const openComment = useCallback(() => { wantCompose.current = true; setExpanded(true); setComposeReq((n) => n + 1); }, []);
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
    const v = vs.find((x) => x.id === versionId) || currentMix(s, vs) || vs[vs.length - 1];
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
  const phone = useRef(false);
  useEffect(() => { const m = window.matchMedia('(max-width: 900px)'); const f = () => { phone.current = m.matches; }; f(); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  const track = useRef(null);
  useEffect(() => {
    let raf;
    const loop = (ts) => {
      const r = rot.current, dt = Math.min(0.05, (ts - (r.last || ts)) / 1000); r.last = ts;
      const a = curAudio();
      if (a && playing && ts - r.lastSet > 200) { r.lastSet = ts; setTime(a.currentTime); }
      const target = playing ? 1 : 0;
      r.vel += (target - r.vel) * (target > r.vel ? 2.2 : 1.1) * dt;
      if (Math.abs(r.vel) > 0.001 && !phone.current) { r.angle = (r.angle + r.vel * 200 * dt) % 360; document.body.style.setProperty('--rot', r.angle.toFixed(2) + 'deg'); } // phones don't spin covers: skip the work
      if (!eng && a && playing && a.duration) listen(a);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  useEffect(() => { document.body.classList.toggle('playing', playing); }, [playing]);

  /* iPhone / Mac lock screen, Control Center, AirPods and keyboard media keys: cover art, title, artist, controls */
  const cur = current;
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
    if (!ms || !cur) return;
    let live = true;
    (async () => {
      const art = artOf(cur.song, cur.project);
      let src = '';
      if (art.path) { const { data } = await supabase().storage.from('mixes').createSignedUrl(art.path, 24 * 3600).catch(() => ({ data: null })); src = data?.signedUrl || ''; }
      if (!src) src = makeArt(art.seed, 512);
      let artist = cur.project?.artist || '';
      try { const { data } = await supabase().from('artists').select('display_name').ilike('name', artist).maybeSingle(); if (data?.display_name) artist = data.display_name; } catch {}
      if (!live || typeof MediaMetadata === 'undefined') return;
      const v = cur.versions.find((x) => x.id === cur.versionId);
      ms.metadata = new MediaMetadata({
        title: cur.song.title,
        artist: [artist, v?.label].filter(Boolean).join(' · '),
        album: cur.project?.title || 'CTRL ROOM',
        artwork: [{ src, sizes: '512x512', type: src.startsWith('data:image/jpeg') ? 'image/jpeg' : src.startsWith('data:image/png') ? 'image/png' : 'image/jpeg' }, { src: '/logo.png', sizes: '512x512', type: 'image/png' }],
      });
    })();
    return () => { live = false; };
  }, [cur?.song?.id, cur?.versionId, cur?.song?.title, cur?.song?.cover_path, cur?.project?.cover_path]); // eslint-disable-line
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
    if (!ms) return;
    const set = (k, fn) => { try { ms.setActionHandler(k, fn); } catch {} };
    set('play', () => resume());
    set('pause', () => pause());
    set('previoustrack', () => step(-1));
    set('nexttrack', () => step(1));
    set('seekbackward', (d) => { const a = curAudio(); if (a) seek(a.currentTime - (d?.seekOffset || 15)); });
    set('seekforward', (d) => { const a = curAudio(); if (a) seek(a.currentTime + (d?.seekOffset || 15)); });
    set('seekto', (d) => { if (d?.seekTime != null) seek(d.seekTime); });
  }, [resume, pause, step, seek]); // eslint-disable-line
  const posAt = useRef(0);
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
    if (!ms) return;
    try { ms.playbackState = cur ? (playing ? 'playing' : 'paused') : 'none'; } catch {}
    const now = Date.now();
    if (cur && duration > 0 && ms.setPositionState && (now - posAt.current > 1000 || !playing)) {
      posAt.current = now;
      try { ms.setPositionState({ duration, playbackRate: 1, position: Math.min(time, duration) }); } catch {}
    }
  }, [playing, time, duration, cur]);

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
  const value = { eng, current, version, queue, playing, time, expanded, setExpanded, composeReq, wantCompose, openComment, duration: duration || version?.duration || 0, play, pause, resume, toggle, seek, switchVersion, refresh, next: () => step(1), prev: () => step(-1) };
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
          <span>{c.project.title} · {v.label}<QualityBadge v={v} short /></span>
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

const initialOf = (n) => String(n.author_name || (n.from_client ? 'C' : 'E')).replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '•';

function NowPlaying() {
  const pl = usePlayer();
  const c = pl.current, v = pl.version;
  const [upNext, setUpNext] = useState([]);
  const [deck, setDeck] = useState('next');
  const [songNotes, setSongNotes] = useState([]);
  const close = () => pl.setExpanded(false);
  const sheet = useRef(null), drag = useRef(null); // swipe down to close (phones)
  const composeBox = useRef(null);
  // quick comment at the exact moment (phone friendly)
  const [composing, setComposing] = useState(false);
  const [pinAt, setPinAt] = useState(0);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState('');
  useEffect(() => { if (pl.wantCompose.current) { pl.wantCompose.current = false; setPinAt(pl.time); setComposing(true); } }, [pl.composeReq]); // eslint-disable-line
  // keep the comment box above the phone keyboard
  useEffect(() => {
    if (!composing) return;
    const vv = window.visualViewport; if (!vv) return;
    const fit = () => document.documentElement.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); document.documentElement.style.setProperty('--kb', '0px'); };
  }, [composing]);
  useEffect(() => { if (composing) requestAnimationFrame(() => sheet.current?.scrollTo({ top: 0, behavior: 'smooth' })); }, [composing]);
  const postComment = async (bodyIn, atIn) => {
    const text = bodyIn ?? '';
    if (!text.trim()) return false;
    setPosting(true);
    const sb = supabase();
    const { data: sess } = await sb.auth.getSession();
    const name = sess.session?.user?.user_metadata?.name || null;
    const { error } = await sb.from('notes').insert({ song_id: c.song.id, version_id: c.versionId, t: atIn == null ? null : Math.round(atIn * 10) / 10, body: text.trim(), author_name: pl.eng ? (name ? `${name} (Engineer)` : 'Engineer') : name, from_client: !pl.eng });
    setPosting(false);
    if (error) { setPosted(error.message); return false; }
    setComposing(false); setText(''); setPosted(atIn == null ? `General note added on ${pl.version?.label || 'this mix'}.` : `Comment added at ${mmss(atIn)} on ${pl.version?.label || 'this mix'}.`);
    setTimeout(() => setPosted(''), 3500);
  };
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
  useEffect(() => { if (upNext.length <= 1 && deck === 'next') setDeck('notes'); }, [upNext.length]); // eslint-disable-line
  useEffect(() => {
    let live = true;
    supabase().from('notes').select('id, t, body, author_name, from_client, version_id, resolved, parent_id, created_at').eq('song_id', c.song.id).is('parent_id', null).order('t', { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (live) setSongNotes(data || []); });
    return () => { live = false; };
  }, [c.song.id, posted]); // eslint-disable-line
  const waveNotes = songNotes.filter((n) => n.t != null && (!n.version_id || n.version_id === c.versionId));
  const active = [...waveNotes].reverse().find((n) => pl.time >= n.t && pl.time - n.t < 4.5) || null;
  const vi = c.versions.findIndex((x) => x.id === c.versionId);
  const flip = () => { const prev = c.versions[vi - 1] || c.versions[vi + 1]; if (prev) pl.switchVersion(prev.id); };
  return (
    <>
    <div className="npscrim" onClick={close} aria-hidden="true" />
    <div className={`np ${composing ? 'composing' : ''}`} role="dialog" aria-label="Now playing" ref={sheet}
      onTouchStart={(e) => { const el = sheet.current; if (!el || el.scrollTop > 0 || e.target.closest('.npwave, textarea, input, .npq, .npvers')) return; drag.current = { y: e.touches[0].clientY, dy: 0 }; }}
      onTouchMove={(e) => {
        const d = drag.current; if (!d) return;
        d.dy = Math.max(0, e.touches[0].clientY - d.y);
        if (d.dy > 4) { sheet.current.style.transition = 'none'; sheet.current.style.transform = `translateY(${d.dy}px)`; }
      }}
      onTouchEnd={() => {
        const d = drag.current; drag.current = null; if (!d || !sheet.current) return;
        const el = sheet.current;
        el.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)';
        if (d.dy > 110) { el.style.transform = 'translateY(100%)'; setTimeout(close, 220); } else el.style.transform = '';
      }}>
      <span className="npgrab" aria-hidden="true" />
      <Cover as="div" {...artOf(c.song, c.project)} size={240} className="npbg" />
      <div className="npinner">
        <div className="nptop">
          <span className="npfrom">Playing from <b>{c.project.title}</b></span>
          <Link className="npopen" href={`/s/${c.song.id}`} onClick={close}>Notes &amp; details</Link>
          <button className="npclose" onClick={close} aria-label="Close the player"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
        </div>
        <div className="npdisc"><Cover as="div" {...artOf(c.song, c.project)} size={640} className="npart spin" /><span className="nphole" /></div>
        <Cover as="div" {...artOf(c.song, c.project)} size={900} className="npsquare" />
        <div className="nphead">
          <div className="nphead-t">
            <h2 className="ttl">{c.song.title}</h2>
            <p className="npsub"><ArtistName name={c.project.artist} /> · {c.project.title}</p>
            <p className="npsub"><Credit project={c.project} /></p>
          </div>
          <button className="npcomment" onClick={() => { setPinAt(pl.time); setComposing(true); }} aria-label="Add a comment at this moment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M12 8.5v4M10 10.5h4" /></svg>
            <span>Comment</span>
          </button>
          {v?.storage_path && (pl.eng || c.project?.allow_download) && <button className="npcomment npdl" onClick={() => downloadVersion(c.song, v)} aria-label={`Download ${v.label}`} title={`Download ${v.label}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            <span>Download</span>
          </button>}
          <div className="npqual"><QualityBadge v={v} size="lg" detail /></div>
        </div>
        {c.versions.length > 1 && (
          <div className="npvers" role="group" aria-label="Versions">
            {c.versions.map((x) => <button key={x.id} aria-pressed={x.id === c.versionId} onClick={() => pl.switchVersion(x.id)}>{x.label}</button>)}
            <span className="nphint">keeps your spot</span>
          </div>
        )}
        <div>
          <div className="npwavewrap">
            <Wave peaks={v?.peaks} time={pl.time} duration={pl.duration} onSeek={pl.seek} height={52} />
            {composing && pinAt != null && pl.duration > 0 && <span className="nppin" style={{ left: `${Math.min(100, (pinAt / pl.duration) * 100)}%` }} aria-hidden="true" />}
            {/* comments on the waveform, SoundCloud style: a dot where each one sits, and a bubble as the song passes it */}
            {pl.duration > 0 && waveNotes.map((n) => (
              <button key={n.id} className={`npmark ${active?.id === n.id ? 'on' : ''}`} style={{ left: `${Math.min(100, (n.t / pl.duration) * 100)}%` }}
                onClick={() => pl.seek(n.t)} aria-label={`${n.author_name || 'Note'} at ${mmss(n.t)}: ${n.body}`} title={`${mmss(n.t)} · ${n.body}`}>
                <span>{initialOf(n)}</span>
              </button>
            ))}
            {active && !composing && pl.duration > 0 && (
              <span className="npbubble" key={active.id} style={{ '--x': `${Math.min(100, (active.t / pl.duration) * 100)}%` }}>
                <b>{active.author_name || (active.from_client ? 'Client' : 'Engineer')}</b> {active.body}
              </span>
            )}
          </div>
          <div className="nptimes mono"><span>{mmss(pl.time)}</span><span className="npfmt">{v?.file_format ? `${v.file_format} · as delivered` : 'Original file'}</span><span className="npdur">{mmss(pl.duration)}</span><span className="npleft">-{mmss(Math.max(0, pl.duration - pl.time))}</span></div>
        </div>
            {composing && (
          <NoteComposer now={pl.time} start={pinAt} duration={pl.duration} label={`On ${pl.version?.label || 'this mix'}`} onAt={(t) => setPinAt(t)}
            onCancel={() => { setComposing(false); setText(''); }} onPost={(body, at) => postComment(body, at)} />
        )}
        <div className="npctl">
          <button className="npskip" onClick={() => pl.seek(Math.max(0, pl.time - 15))} aria-label="Back 15 seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 103-6.7L3 8" /><path d="M3 3v5h5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">15</text></svg></button>
          <button onClick={pl.prev} aria-label="Previous song (or back to the start)"><svg viewBox="0 0 24 24"><path d="M11 12l9-6.5v13zM2 12l9-6.5v13z" /></svg></button>
          <button className="npplay" onClick={pl.toggle} aria-label={pl.playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{pl.playing ? PAUSE : PLAY}</svg></button>
          <button onClick={pl.next} aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M13 12L4 5.5v13zM22 12l-9-6.5v13z" /></svg></button>
          <button className="npskip" onClick={() => pl.seek(Math.min(pl.duration || 0, pl.time + 15))} aria-label="Forward 15 seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">15</text></svg></button>
        </div>
        {posted && <p className="npposted" role="status">{posted}</p>}
        <div className="npdeck">
          <div className="npdtabs" role="tablist" aria-label="More about this song">
            {upNext.length > 1 && <button role="tab" aria-selected={deck === 'next'} onClick={() => setDeck('next')}>Playlist</button>}
            <button role="tab" aria-selected={deck === 'notes'} onClick={() => setDeck('notes')}>Notes{songNotes.length ? <i>{songNotes.length}</i> : null}</button>
            <button role="tab" aria-selected={deck === 'progress'} onClick={() => setDeck('progress')}>Progress</button>
            <button role="tab" aria-selected={deck === 'details'} onClick={() => setDeck('details')}>Details</button>
          </div>
          {deck === 'next' && upNext.length > 1 && (
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
          )}
          {deck === 'notes' && (
            <div className="npnotes">
              {songNotes.length ? songNotes.map((n) => (
                <button key={n.id} className={`npnote ${n.resolved ? 'done' : ''}`} onClick={() => { if (n.version_id && n.version_id !== c.versionId) pl.switchVersion(n.version_id); if (n.t != null) pl.seek(n.t); }}>
                  <span className="npnt mono">{n.t != null ? mmss(n.t) : '—'}</span>
                  <span className="npnb"><b>{n.author_name || (n.from_client ? 'Client' : 'Engineer')}{n.version_id ? ` · ${c.versions.find((v) => v.id === n.version_id)?.label || ''}` : ''}</b><span>{n.body}</span></span>
                </button>
              )) : <p className="npempty">No notes yet. Tap Comment at the moment you hear something.</p>}
              <Link className="npmore" href={`/s/${c.song.id}#notes`} onClick={close}>All notes &amp; replies ›</Link>
            </div>
          )}
          {deck === 'progress' && <SongProgress steps={{ received: c.song.received_at, mixing: c.song.mixing_at, review: (c.versions.filter((x) => !/^demo/i.test(x.label)).at(-1)?.created_at || '').slice(0, 10) || null, approved: c.song.approved_at }} />}
          {deck === 'details' && <SongDetails rows={[
            ['Version', v?.label], ['Length', v?.duration ? mmss(v.duration) : null], ['BPM', c.song.bpm], ['Key', c.song.musical_key],
            ['Format', v?.file_format ? [v.file_format, v.sample_rate ? `${(v.sample_rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '', v.bit_depth ? `${v.bit_depth}-bit` : ''].filter(Boolean).join(' · ') : null],
            ['Versions', c.versions.length], ['Delivered', v?.created_at ? new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null],
          ]} />}
        </div>
      </div>
    </div>
    </>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmt, mmss, fmtDate, shortDate, ago, statusText, nextLabel, deviceName, todayISO } from '@/lib/format';
import { deliverFile } from '@/lib/deliver';
import { describeFormat } from '@/lib/fileinfo';

const BINS = 100;
const PLAY = <path d="M7 4.5v15l13-7.5z" />;
const PAUSE = <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />;

export default function SongPage() {
  const { id } = useParams();
  const { eng, email } = useApp();
  const [song, setSong] = useState(undefined);
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [plays, setPlays] = useState([]);
  const [urls, setUrls] = useState({});
  const [vid, setVid] = useState(null);
  const [ab, setAb] = useState({ a: null, b: null });
  const [tab, setTab] = useState('notes');
  const [msg, setMsg] = useState('');

  // playback
  const audios = useRef({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: s } = await sb.from('songs').select('*, projects(*)').eq('id', id).single();
    if (!s) { setSong(null); return; }
    const [{ data: vs }, { data: ns }, { data: us }] = await Promise.all([
      sb.from('versions').select('*').eq('song_id', id).order('created_at'),
      sb.from('notes').select('*').eq('song_id', id).order('created_at'),
      sb.from('updates').select('*').eq('song_id', id).order('created_at', { ascending: false }),
    ]);
    setSong(s); setVersions(vs || []); setNotes(ns || []); setUpdates(us || []);
    const list = vs || [];
    if (list.length) {
      const { data: signed } = await sb.storage.from('mixes').createSignedUrls(list.map((v) => v.storage_path), 6 * 3600);
      const map = {};
      (signed || []).forEach((x, i) => { if (x.signedUrl) map[list[i].id] = x.signedUrl; });
      setUrls(map);
      setVid((cur) => (cur && list.some((v) => v.id === cur) ? cur : list[list.length - 1].id));
      setAb((cur) => (cur.a && cur.b && list.some((v) => v.id === cur.a) && list.some((v) => v.id === cur.b) ? cur
        : { a: list[Math.max(0, list.length - 2)].id, b: list[list.length - 1].id }));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!eng) return;
    supabase().from('plays').select('*').eq('song_id', id).order('updated_at', { ascending: false }).then(({ data }) => setPlays(data || []));
  }, [eng, id, song]);

  const v = versions.find((x) => x.id === vid) || null;
  const p = song?.projects;

  /* ---------- audio ---------- */
  const audioFor = useCallback((verId) => {
    if (!urls[verId]) return null;
    let a = audios.current[verId];
    if (!a) {
      a = new Audio();
      a.preload = 'auto';
      a.volume = 1; // full, unchanged level — no processing anywhere in the chain
      a.src = urls[verId];
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('loadedmetadata', () => { if (verId === vidRef.current) setDur(a.duration || 0); });
      audios.current[verId] = a;
    }
    return a;
  }, [urls]);
  const vidRef = useRef(vid);
  useEffect(() => { vidRef.current = vid; const a = vid && audioFor(vid); if (a) setDur(a.duration || v?.duration || 0); }, [vid, audioFor, v]);
  useEffect(() => () => { Object.values(audios.current).forEach((a) => { a.pause(); a.src = ''; }); document.body.classList.remove('playing'); }, []);
  useEffect(() => { document.body.classList.toggle('playing', playing); }, [playing]);

  const cur = () => (vid ? audioFor(vid) : null);
  const play = () => { const a = cur(); if (!a) return; a.play().then(() => setPlaying(true)).catch(() => setMsg("Couldn't start playback. Tap play again.")); };
  const pause = () => { const a = cur(); if (a) a.pause(); setPlaying(false); };
  const toggle = () => (playing ? pause() : play());
  const seek = (t) => { const a = cur(); if (a) { a.currentTime = Math.max(0, Math.min(t, a.duration || t)); setTime(a.currentTime); } };
  const switchTo = (newId) => {
    if (!newId || newId === vid) return;
    const a = cur(), t = a ? a.currentTime : 0, was = playing;
    if (a) a.pause();
    setVid(newId);
    const b = audioFor(newId);
    if (b) {
      const go = () => { try { b.currentTime = Math.min(t, b.duration || t); } catch {} if (was) b.play().catch(() => {}); };
      if (b.readyState >= 1) go(); else b.addEventListener('loadedmetadata', go, { once: true });
    }
    document.querySelector('.bigdisc')?.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-28deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 550, easing: 'cubic-bezier(.3,.7,.3,1)' });
  };
  const flip = () => { if (ab.a && ab.b) switchTo(vid === ab.b ? ab.a : ab.b); };

  /* ---------- frame loop: time, turntable, listen tracking ---------- */
  const track = useRef(null);
  const rot = useRef({ angle: 0, vel: 0, last: 0 });
  useEffect(() => {
    let raf;
    const loop = (ts) => {
      const r = rot.current, dt = Math.min(0.05, (ts - (r.last || ts)) / 1000); r.last = ts;
      const a = vid ? audios.current[vid] : null;
      if (a && playing) setTime(a.currentTime);
      const target = playing ? 1 : 0;
      r.vel += (target - r.vel) * (target > r.vel ? 2.2 : 1.1) * dt;
      if (Math.abs(r.vel) > 0.001) { r.angle = (r.angle + r.vel * 200 * dt) % 360; document.body.style.setProperty('--rot', r.angle.toFixed(2) + 'deg'); }
      if (!eng && a && playing && a.duration) listen(a);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function listen(a) {
    let t = track.current;
    if (!t || t.vid !== vid) {
      t = track.current = { vid, bins: new Uint8Array(BINS), last: null, rowId: null, creating: false, savedAt: 0 };
    }
    const d = a.duration, pos = a.currentTime, b = Math.min(BINS - 1, Math.floor((pos / d) * BINS));
    if (t.last != null && pos >= t.last && pos - t.last < 1) t.bins[b] = Math.min(255, t.bins[b] + (t.lastBin !== b ? 1 : 0));
    t.lastBin = b; t.last = pos;
    const covered = t.bins.reduce((n, x) => n + (x ? 1 : 0), 0), listened = (covered / BINS) * d;
    const now = Date.now();
    if (!t.rowId && !t.creating) {
      t.creating = true;
      const from = new URLSearchParams(window.location.search).get('from');
      supabase().from('plays').insert({ song_id: id, version_id: vid, device: deviceName(), source: from === 'text' ? 'from your text' : 'in Ctrl Room', duration: d, listened: 0 })
        .select('id').single().then(({ data }) => { if (data) t.rowId = data.id; t.creating = false; });
    } else if (t.rowId && now - t.savedAt > 5000) {
      t.savedAt = now;
      supabase().from('plays').update({ listened, duration: d, bins: Array.from(t.bins).join(','), updated_at: new Date().toISOString() }).eq('id', t.rowId).then(() => {});
    }
  }

  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('textarea,input,select,[contenteditable]')) return;
      if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); toggle(); }
      if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey) flip();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  if (song === undefined) return <><TopBar crumbs={[{ label: 'Loading…' }]} /><section className="page" /></>;
  if (song === null) return (
    <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Not found' }]} />
      <section className="page"><div className="empty-state"><strong>This song isn't available</strong>Sign in with the email your engineer has for you.</div></section></>
  );

  const hasMix = versions.length > 0;
  const openNotes = notes.filter((n) => !n.resolved).length;
  const crumbs = [...(eng ? [{ label: 'Home', href: '/' }] : []), { label: p.title, href: `/p/${p.id}` }, { label: song.title }];
  const tabs = [
    hasMix && ['notes', 'Notes', openNotes, openNotes > 0],
    ['progress', 'Progress'],
    ['updates', 'Updates', updates.length],
    ['about', 'About this song'],
    eng && hasMix && ['activity', 'Listening', plays.length],
  ].filter(Boolean);
  const curTab = tabs.some((t) => t[0] === tab) ? tab : tabs[0][0];

  return (
    <>
      <TopBar crumbs={crumbs} />
      <section className="page">
        <div className="shero">
          <div className="bigdisc">
            <Cover as="div" seed={song.seed} size={640} className="art spin" />
            <div className="arm" aria-hidden="true"><svg viewBox="0 0 100 170">
              <circle cx="80" cy="14" r="13" fill="#1d1d20" stroke="#3a3a40" strokeWidth="2" />
              <circle cx="80" cy="14" r="5" fill="#9a9aa2" />
              <path d="M80 14 C 78 60, 62 110, 44 140" fill="none" stroke="#d6d6db" strokeWidth="4.5" strokeLinecap="round" />
              <rect x="30" y="136" width="22" height="30" rx="4" fill="#ececef" transform="rotate(28 41 151)" />
              <rect x="34" y="150" width="6" height="8" rx="1.5" fill="#f5d547" transform="rotate(28 41 151)" />
            </svg></div>
            <button className="hub" onClick={toggle} disabled={!v || !urls[v.id]} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          </div>
          <div className="sinfo">
            <p className="eyebrow"><Link href={`/p/${p.id}`}>{p.title}</Link> · {p.artist}</p>
            <SongTitle song={song} eng={eng} reload={load} />
            <div className="meta"><span className={`dot ${song.status}`}>{statusText(song, versions)}</span>
              <span>{[song.bpm ? `${song.bpm} BPM` : '', hasMix ? `${versions.length} version${versions.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</span></div>
            {hasMix && <Versions {...{ versions, vid, ab, setAb, switchTo, flip, eng, song, reload: load, setMsg }} />}
            {v?.note && <p className="vnote">{v.label}: {v.note}</p>}
            {eng && <DeliverVersion song={song} versions={versions} onDone={load} setMsg={setMsg} />}
            {msg && <p className="upmsg">{msg}</p>}
            {hasMix && <Decision {...{ eng, song, v, versions, notes, reload: load, setMsg, setTab }} />}
          </div>
        </div>

        {hasMix ? (
          <Scrub {...{ v, notes, time, dur: dur || v?.duration || 0, seek, eng, plays }} />
        ) : (
          <div className="nomix"><strong className="up">No mix yet</strong>{song.eta ? `The first mix is expected ${fmtDate(song.eta)}.` : 'The first mix will show up here.'}{p.phone ? " You'll get a text the moment it's ready." : ''}</div>
        )}

        <div className="stabs" role="tablist" aria-label="Song details">
          {tabs.map(([k, l, c, hot]) => (
            <button key={k} className="stab" role="tab" aria-selected={k === curTab} onClick={() => setTab(k)}>{l}{c ? <span className={`cnt ${hot ? 'hot' : ''}`}>{c}</span> : null}</button>
          ))}
        </div>
        {curTab === 'notes' && <Notes {...{ notes, v, versions, time, playing, seek, setVid: switchTo, eng, email, song, reload: load }} />}
        {curTab === 'progress' && <Progress {...{ song, versions, eng, reload: load }} />}
        {curTab === 'updates' && <Updates {...{ updates, eng, song, p, reload: load }} />}
        {curTab === 'about' && <About {...{ song, eng, reload: load }} />}
        {curTab === 'activity' && <Listening {...{ plays, versions }} />}
      </section>
    </>
  );
}

/* ---------- versions timeline + A/B ---------- */
function Versions({ versions, vid, ab, setAb, switchTo, flip, eng, song, reload, setMsg }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const vi = versions.findIndex((x) => x.id === vid);
  const side = vid === ab.a ? 'a' : vid === ab.b ? 'b' : 'none';
  const rename = async (ver) => {
    const nl = draft.trim();
    setEditing(null);
    if (!nl || nl === ver.label) return;
    if (versions.some((x) => x.id !== ver.id && x.label.toLowerCase() === nl.toLowerCase())) return setMsg(`There's already a version called ${nl}.`);
    const { error } = await supabase().from('versions').update({ label: nl }).eq('id', ver.id);
    setMsg(error ? error.message : `Renamed ${ver.label} to ${nl}.`);
    reload();
  };
  const pick = (k, idv) => {
    const other = k === 'a' ? 'b' : 'a';
    const next = { ...ab, [k]: idv };
    if (idv === ab[other]) next[other] = ab[k];
    const wasOn = vid === ab[k];
    setAb(next);
    if (wasOn) switchTo(idv);
  };
  return (
    <div className="vblock">
      <div className="vtrack">
        {versions.map((x, i) => (
          <div key={x.id} className={`vnode ${x.id === vid ? 'cur' : ''} ${i < vi ? 'past' : ''} ${song.approved_version === x.id ? 'ok' : ''}`}>
            <button className="vpick" onClick={() => switchTo(x.id)} aria-pressed={x.id === vid} aria-label={`Play ${x.label}`}><span className="vdot" /></button>
            <span className="vlab">
              {editing === x.id ? (
                <input className="vrename" value={draft} maxLength={14} autoFocus aria-label={`Rename ${x.label}`}
                  onChange={(e) => setDraft(e.target.value)} onBlur={() => rename(x)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
              ) : (
                <>
                  <button onClick={() => switchTo(x.id)}>{x.label}</button>
                  {eng && <button className="vedit" title="Rename" aria-label={`Rename ${x.label}`} onClick={() => { setDraft(x.label); setEditing(x.id); }}>✎</button>}
                </>
              )}
            </span>
            <span className="vdate">{shortDate(x.created_at)}</span>
            {versions.length > 1 && (x.id === ab.a ? <span className="vchip a">A</span> : x.id === ab.b ? <span className="vchip b">B</span> : null)}
          </div>
        ))}
      </div>
      {versions.length > 1 && (
        <div className="abbar">
          <div className={`abslot a ${side === 'a' ? 'on' : ''}`}><span className="abletter">A</span>
            <select value={ab.a || ''} onChange={(e) => pick('a', e.target.value)} aria-label="Version A">{versions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <button className="abswitch" data-side={side} onClick={flip} aria-label="Flip between A and B"><i>{side === 'a' ? 'A' : side === 'b' ? 'B' : '·'}</i></button>
          <div className={`abslot b ${side === 'b' ? 'on' : ''}`}><span className="abletter">B</span>
            <select value={ab.b || ''} onChange={(e) => pick('b', e.target.value)} aria-label="Version B">{versions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <span className="abhint">Flips at the same spot · <kbd>X</kbd></span>
        </div>
      )}
    </div>
  );
}

/* ---------- deliver a new version (engineer) ---------- */
function DeliverVersion({ song, versions, onDone, setMsg }) {
  const [busy, setBusy] = useState('');
  const [text, setText] = useState(true);
  const inputId = `deliver-${song.id}`;
  const deliver = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = await deliverFile({ song, versions, file: f, project: song.projects, text, onStatus: setBusy });
      const aiffNote = r.info?.file_format === 'AIFF' ? ' Heads up: Chrome and Android can\'t play AIFF. WAV plays everywhere.' : '';
      setMsg(`Delivered ${f.name} as ${r.label}${r.parsed.note ? ` (${r.parsed.note})` : ''}.${text ? (r.texted ? ' Texted the client.' : ' (Text not sent — check the phone number and Twilio setup.)') : ''} Tap ✎ to rename it.${aiffNote}`);
      onDone();
    } catch (err) {
      setMsg(`Couldn't deliver ${f.name}: ${err.message}`);
    } finally { setBusy(''); }
  };
  return (
    <div className="row-actions">
      <label className="btn small" htmlFor={inputId} style={{ cursor: 'pointer' }}>{busy || '+ Deliver new version'}</label>
      <input id={inputId} className="vh" type="file" accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={deliver} disabled={!!busy} />
      <label className="smsopt"><input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Text the client</label>
    </div>
  );
}

/* ---------- approve / request changes ---------- */
function Decision({ eng, song, v, versions, notes, reload, setMsg, setTab }) {
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  if (!v) return null;
  const sb = supabase();
  if (eng) {
    const ap = versions.find((x) => x.id === song.approved_version);
    return <div className="decision"><span className="grow">{song.status === 'approved' ? <><b>{ap?.label} is signed off.</b> You're clear to print final masters.</> : song.status === 'changes' ? <><b>The client asked for changes.</b> Their notes are in the Notes tab.</> : `Waiting on the client to review ${versions.at(-1).label}.`}</span></div>;
  }
  const latest = versions.at(-1);
  if (song.status === 'approved' && song.approved_version === v.id) {
    return <div className="decision"><span className="grow"><span className="dot approved">You approved {v.label}.</span> Your engineer has been notified.</span>
      <button className="btn quiet" onClick={async () => { await sb.rpc('undo_approval', { p_song: song.id }); reload(); }}>Undo</button></div>;
  }
  if (confirming) {
    return <div className="decision"><span className="grow"><b>Approve {v.label} as the final mix?</b> Your engineer moves on to masters.</span>
      <button className="btn quiet" onClick={() => setConfirming(false)}>Cancel</button>
      <button className="btn primary" onClick={async () => {
        const { error } = await sb.rpc('approve_version', { p_song: song.id, p_version: v.id });
        setConfirming(false);
        if (error) return setErr(error.message);
        document.querySelector('.bigdisc')?.classList.add('stamp'); setTimeout(() => document.querySelector('.bigdisc')?.classList.remove('stamp'), 1500);
        reload();
      }}>Yes, approve {v.label}</button></div>;
  }
  return (
    <div className="decision">
      <span className="grow">{v.id !== latest.id ? `This is an older version. The latest is ${latest.label}.` : song.status === 'changes' ? 'Changes requested. Your engineer is on it.' : <b>Happy with this mix?</b>}</span>
      <button className="btn" onClick={async () => {
        const mine = notes.some((n) => n.version_id === v.id && !n.resolved && n.from_client);
        if (!mine) { setErr('Leave at least one note first so your engineer knows what to change.'); setTab('notes'); return; }
        const { error } = await sb.rpc('request_changes', { p_song: song.id, p_version: v.id });
        if (error) return setErr(error.message);
        setErr(''); reload();
      }}>Request changes</button>
      <button className="btn primary" onClick={() => { setErr(''); setConfirming(true); }}>Approve {v.label}</button>
      {err && <p className="msg">{err}</p>}
    </div>
  );
}

/* ---------- waveform + markers ---------- */
function Scrub({ v, notes, time, dur, seek, eng, plays }) {
  const cv = useRef(null), wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const drag = useRef(false);
  const peaks = v?.peaks || null;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
    const step = 3 * dpr, bw = 2 * dpr, n = Math.floor(W / step), prog = dur ? time / dur : 0;
    for (let i = 0; i < n; i++) {
      let p = 0.05;
      if (peaks?.length) { const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length)); p = 0; for (let j = a; j < b; j++) p = Math.max(p, peaks[j] || 0); }
      const h = Math.max(2 * dpr, Math.min(1, p) * H * 0.96), y = (H - h) / 2;
      g.fillStyle = i / n < prog ? '#f4f4f5' : '#47474d';
      g.fillRect(i * step, y, bw, h);
    }
    g.fillStyle = '#f5d547'; g.fillRect(Math.round(prog * W) - dpr, 0, Math.max(2, 2 * dpr), H);
    if (hover != null) { g.globalAlpha = 0.4; g.fillStyle = '#f4f4f5'; g.fillRect(Math.round(hover * dpr), 0, Math.max(1, dpr), H); g.globalAlpha = 1; }
  });
  const xToT = (e) => { const r = wrap.current.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur; };
  const vNotes = notes.filter((n) => n.version_id === v?.id && n.t != null).sort((a, b) => a.t - b.t);
  const heat = useMemo(() => {
    if (!eng || !v) return null;
    const h = new Array(BINS).fill(0);
    plays.filter((x) => x.version_id === v.id && x.bins).forEach((x) => x.bins.split(',').forEach((n, i) => { h[i] += Number(n) || 0; }));
    return h;
  }, [eng, plays, v]);
  const mx = heat ? Math.max(...heat) : 0;
  return (
    <div className="scrub">
      <div className="wave" ref={wrap}
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); seek(xToT(e)); }}
        onPointerMove={(e) => { const r = wrap.current.getBoundingClientRect(); setHover(Math.max(0, Math.min(r.width, e.clientX - r.left))); if (drag.current) seek(xToT(e)); }}
        onPointerUp={() => { drag.current = false; }} onPointerLeave={() => setHover(null)}
        aria-label="Waveform. Click to jump to a point in the song.">
        <canvas ref={cv} />
        {hover != null && <div className="hovert mono" style={{ left: hover }}>{fmt((hover / (wrap.current?.getBoundingClientRect().width || 1)) * dur)}</div>}
      </div>
      <div className="lane">
        {dur > 0 && vNotes.map((n, i) => (
          <button key={n.id} className={`mk ${n.resolved ? 'done' : ''}`} style={{ left: `${(n.t / dur) * 100}%` }} title={`${fmt(n.t)} · ${n.body}`} onClick={() => seek(n.t)} aria-label={`Note ${i + 1} at ${fmt(n.t)}`}>{i + 1}</button>
        ))}
      </div>
      {heat && (
        <div className="listenmap">
          <div className="lmlabel"><b>Listen map</b><span>{mx ? `Heard ${Math.round((heat.filter((x) => x > 0).length / BINS) * 100)}% of ${v.label}` : `The client hasn't played ${v.label} yet.`}</span></div>
          <div className={`lmbars ${mx ? '' : 'empty'}`}>{heat.map((x, i) => <i key={i} style={{ opacity: mx ? (x ? 0.18 + (0.82 * x) / mx : 0) : 1 }} />)}</div>
        </div>
      )}
      <div className="times"><span className="mono">{fmt(time)}</span><span className="mono fmtinfo" title="Played straight from the uploaded file: no compression, no limiting, no volume changes.">{describeFormat(v) ? <><b>{describeFormat(v)}</b> · {v.lossless === false ? 'as uploaded, no extra compression' : 'original, untouched'}</> : 'Original file, untouched'}{v?.peak_db != null ? ` · Peak ${v.peak_db} dBFS` : ''}</span><span className="mono">{fmt(dur)}</span></div>
    </div>
  );
}

/* ---------- notes ---------- */
function Notes({ notes, v, versions, time, playing, seek, setVid, eng, email, song, reload }) {
  const [filter, setFilter] = useState('this');
  const [mode, setMode] = useState('time');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(null);
  const [busy, setBusy] = useState(false);
  const at = pinned != null ? pinned : time;
  const list = notes.filter((n) => filter === 'all' || n.version_id === v?.id).sort((a, b) => (a.t ?? -1) - (b.t ?? -1));
  const label = (vid) => versions.find((x) => x.id === vid)?.label || '';
  const nums = {};
  notes.filter((n) => n.version_id === v?.id && n.t != null).sort((a, b) => a.t - b.t).forEach((n, i) => { nums[n.id] = i + 1; });
  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    await supabase().from('notes').insert({ song_id: song.id, version_id: v?.id || null, t: mode === 'time' ? Math.round(at * 10) / 10 : null, body: body.trim(), author_name: eng ? 'Engineer' : null, from_client: !eng });
    setBusy(false); setBody(''); setPinned(null); reload();
  };
  const resolve = async (n) => { await supabase().from('notes').update({ resolved: !n.resolved }).eq('id', n.id); reload(); };
  return (
    <section>
      <div className="boxhead">
        <div className="tabs" role="group" aria-label="Which notes">
          <button aria-pressed={filter === 'this'} onClick={() => setFilter('this')}>This version ({notes.filter((n) => n.version_id === v?.id).length})</button>
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({notes.length})</button>
        </div>
      </div>
      <div className="composer">
        <textarea rows={2} value={body} placeholder={mode === 'time' ? 'Note on this moment, like “vocal feels buried here.”' : 'Note on the whole mix, like “overall it could be louder.”'}
          onChange={(e) => { setBody(e.target.value); if (mode === 'time' && pinned == null && e.target.value.trim()) setPinned(time); if (!e.target.value.trim()) setPinned(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }} aria-label="Note" />
        <div className="row2">
          <span className="pin">
            <span className="nmode" role="group" aria-label="Note type">
              <button aria-pressed={mode === 'time'} data-mode="time" onClick={() => { setMode('time'); if (body.trim()) setPinned(time); }}>At <span className="mono">{fmt(at)}</span></button>
              <button aria-pressed={mode === 'general'} data-mode="general" onClick={() => setMode('general')}>General note</button>
            </span>
            {mode === 'time' && pinned != null && <button className="repin" onClick={() => setPinned(time)}>Use current time</button>}
          </span>
          <button className="post" onClick={post} disabled={!body.trim() || busy}>{mode === 'time' ? `Post at ${fmt(at)}` : 'Post general note'}</button>
        </div>
      </div>
      <ul className="clist">
        {list.length ? list.map((n) => (
          <li key={n.id} className={`cm ${n.resolved ? 'done' : ''}`}>
            {n.t != null ? <button className="ts" onClick={() => { if (n.version_id && n.version_id !== v?.id) setVid(n.version_id); seek(n.t); }}>{nums[n.id] ? <i>{nums[n.id]}</i> : null}{fmt(n.t)}</button> : <span className="ts none">General</span>}
            <div><div className="who"><b>{n.from_client ? (n.author_email === email ? 'You' : n.author_email || 'Client') : eng ? 'You' : 'Your engineer'}</b> · {ago(n.created_at)}{filter === 'all' ? ` · ${label(n.version_id)}` : ''}{n.resolved ? ' · resolved' : ''}</div><p className="txt">{n.body}</p></div>
            {eng ? <button className="resolve" onClick={() => resolve(n)}>{n.resolved ? 'Reopen' : 'Resolve'}</button> : <span />}
          </li>
        )) : <li className="empty">No notes on this version yet. Press play and type when something catches your ear.</li>}
      </ul>
    </section>
  );
}

/* ---------- progress ---------- */
function Progress({ song, versions, eng, reload }) {
  const sb = supabase();
  const first = versions[0], last = versions.at(-1);
  const steps = [
    ['Files received', song.received_at], ['Files downloaded', song.downloaded_at], ['Mixing', song.mixing_at],
    [last && versions.length > 1 ? `Delivered ${last.label}` : 'Mix delivered', last?.created_at], ['Approved', song.status === 'approved' ? song.approved_at : null],
  ];
  const cur = steps.findIndex((s) => !s[1]);
  const next = versions.length ? `v${versions.length + 1}` : 'First mix';
  const mark = async (field, text) => {
    await sb.from('songs').update({ [field]: todayISO(), ...(field === 'mixing_at' ? { status: song.status === 'approved' ? song.status : song.status } : {}) }).eq('id', song.id);
    let texted = false;
    try { texted = (await api('/api/sms', { songId: song.id, body: text })).sent; } catch {}
    await sb.from('updates').insert({ song_id: song.id, body: text, texted });
    reload();
  };
  const setEta = async (val) => {
    await sb.from('songs').update({ eta: val || null }).eq('id', song.id);
    if (val) await sb.from('updates').insert({ song_id: song.id, body: `${next} is now expected ${fmtDate(val)}.` });
    reload();
  };
  return (
    <section className="prog">
      <ol className="steps">
        {steps.map(([l, d], i) => (
          <li key={l} className={`step ${d ? 'done' : i === cur ? 'now' : 'todo'}`}><b>{l}</b><small>{d ? shortDate(d) : i === cur ? (i === 3 && song.eta ? `exp. ${fmtDate(song.eta)}` : 'next') : '—'}</small></li>
        ))}
      </ol>
      <div className="eta">
        {song.status === 'approved' ? <span>Signed off {shortDate(song.approved_at)}.</span>
          : eng ? <><span>{next} expected</span><input type="date" defaultValue={song.eta || ''} onChange={(e) => setEta(e.target.value)} aria-label="Expected delivery date" /></>
          : (song.status === 'review' ? <span>{last?.label} is ready and waiting on your review.</span> : <><span>{next} expected</span><strong className="up">{song.eta ? fmtDate(song.eta) : 'Date coming soon'}</strong></>)}
      </div>
      {song.files_summary && <p className="files">Files: {song.files_summary}</p>}
      {eng && (
        <div className="stepbtns">
          {!song.downloaded_at && <button className="btn small" onClick={() => mark('downloaded_at', 'Downloaded your files. Everything looks good.')}>Mark files downloaded</button>}
          {song.downloaded_at && !song.mixing_at && <button className="btn small" onClick={() => mark('mixing_at', `Started mixing ${song.title}.`)}>Mark mixing started</button>}
        </div>
      )}
    </section>
  );
}

/* ---------- updates ---------- */
function Updates({ updates, eng, song, p, reload }) {
  const [body, setBody] = useState('');
  const [text, setText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    let texted = false, reason = '';
    if (text) { try { const r = await api('/api/sms', { songId: song.id, body: body.trim() }); texted = r.sent; reason = r.reason || ''; } catch (e) { reason = e.message; } }
    await supabase().from('updates').insert({ song_id: song.id, body: body.trim(), texted });
    setBusy(false); setBody(''); setNote(text && !texted ? `Posted, but the text didn't go out: ${reason}` : texted ? 'Posted and texted.' : 'Posted.'); reload();
  };
  return (
    <section>
      {eng && (
        <div className="composer">
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Post an update, like “Vocals are tuned, starting the mix tonight.”" aria-label="Update" />
          <div className="row2">
            <label className="smsopt"><input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Text the client{p.phone ? ` at ${p.phone}` : ' (no phone on file)'}</label>
            <button className="post" onClick={post} disabled={!body.trim() || busy}>{busy ? 'Posting…' : 'Post update'}</button>
          </div>
          {text && body.trim() && <p className="smsprev"><b>Text:</b> {song.title}: {body.trim()} Listen: [link to this song]</p>}
        </div>
      )}
      {note && <p className="toast-inline">{note}</p>}
      <ul className="feed">
        {updates.length ? updates.map((u) => (
          <li key={u.id} className={u.from_client ? 'client' : 'mine'}>
            <span className="av">{u.from_client ? 'C' : 'E'}</span>
            <div><div className="who"><b>{u.from_client ? (eng ? 'Client' : 'You') : eng ? 'You' : 'Your engineer'}</b> · {ago(u.created_at)}</div><p className="txt">{u.body}</p>{eng && u.texted && <span className="sms">Texted to client</span>}</div>
          </li>
        )) : <li><span /><p className="txt muted">No updates yet.</p></li>}
      </ul>
    </section>
  );
}

/* ---------- about ---------- */
function About({ song, eng, reload }) {
  const fields = [['bpm', 'BPM'], ['musical_key', 'Key'], ['reference', 'Reference'], ['artist_notes', 'Notes from the artist'], ['isrc', 'ISRC']];
  const save = async (k, val) => {
    const v = k === 'bpm' ? (Number(val) || null) : (val.trim() || null);
    if ((song[k] ?? null) === v) return;
    await supabase().from('songs').update({ [k]: v }).eq('id', song.id);
    reload();
  };
  if (eng) {
    return (
      <section className="panel">
        {fields.map(([k, l]) => (
          <div className="fld" key={k}><label htmlFor={`ab-${k}`}>{l}</label>
            {k === 'artist_notes' ? <textarea id={`ab-${k}`} rows={3} defaultValue={song[k] || ''} onBlur={(e) => save(k, e.target.value)} />
              : <input id={`ab-${k}`} defaultValue={song[k] ?? ''} onBlur={(e) => save(k, e.target.value)} />}
          </div>
        ))}
        <p className="muted small" style={{ margin: 0 }}>Changes save when you click away.</p>
      </section>
    );
  }
  const isLink = /^https?:\/\//i.test(song.reference || '');
  const has = fields.some(([k]) => song[k]);
  return (
    <section className="songinfo" style={{ display: 'flex' }}>
      {song.bpm && <span className="sichip"><b>{song.bpm}</b> BPM</span>}
      {song.musical_key && <span className="sichip">Key <b>{song.musical_key}</b></span>}
      {song.reference && <span className="sichip">Ref {isLink ? <a href={song.reference} target="_blank" rel="noopener noreferrer">open link ↗</a> : <b>{song.reference}</b>}</span>}
      {song.isrc && <span className="sichip">ISRC <b className="mono">{song.isrc}</b></span>}
      {song.artist_notes && <p className="sinote"><span>Your notes:</span> “{song.artist_notes}”</p>}
      {!has && <p className="muted">Nothing here yet.</p>}
    </section>
  );
}

/* ---------- listening (engineer) ---------- */
function Listening({ plays, versions }) {
  const label = (id) => versions.find((x) => x.id === id)?.label || '';
  return (
    <ul className="act">
      {plays.length ? plays.map((x) => {
        const pct = x.duration ? Math.min(100, Math.round((x.listened / x.duration) * 100)) : 0;
        return (
          <li key={x.id} style={{ display: 'grid', gap: 6 }}>
            <span><b>{x.listener_email || 'Client'}</b> played <span className="mono">{label(x.version_id)}</span> · {x.device || 'Unknown device'}{x.source ? ` · ${x.source}` : ''}</span>
            <span className="nlisten"><span className="nbar"><i style={{ width: `${pct}%` }} /></span><small className="mono">{mmss(x.listened)} of {mmss(x.duration)} · {pct}% · {ago(x.updated_at)}</small></span>
          </li>
        );
      }) : <li><span className="muted">No plays yet. You'll see each listen here: who, which version, what device, and how much they heard.</span></li>}
    </ul>
  );
}

/* ---------- song title (editable by the engineer) ---------- */
function SongTitle({ song, eng, reload }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(song.title);
  const save = async () => {
    const t = draft.trim();
    setEditing(false);
    if (!t || t === song.title) return setDraft(song.title);
    await supabase().from('songs').update({ title: t }).eq('id', song.id);
    reload();
  };
  if (!eng) return <h1 className="up">{song.title}</h1>;
  if (editing) {
    return <input className="titleedit up" value={draft} autoFocus maxLength={120} aria-label="Song title"
      onChange={(e) => setDraft(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(song.title); setEditing(false); } }} />;
  }
  return (
    <h1 className="up titlewrap">{song.title}
      <button className="titlepen" onClick={() => { setDraft(song.title); setEditing(true); }} aria-label="Rename song" title="Rename song">✎</button>
    </h1>
  );
}

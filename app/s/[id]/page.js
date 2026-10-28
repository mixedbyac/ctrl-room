'use client';
import QualityBadge from '@/components/QualityBadge';
import InlineText from '@/components/InlineText';
import CommentList from '@/components/Comments';
import { InvoiceNotice, useInvoices, lockingInvoice } from '@/components/Invoices';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { artOf } from '@/lib/art';
import { fmt, mmss, fmtDate, shortDate, ago, statusText, nextLabel, deviceName, todayISO, orderVersions, latestMix, demoOf, mixesOf, isDemo } from '@/lib/format';
import { uploadDemo } from '@/lib/demo';
import { deliverFile } from '@/lib/deliver';
import { describeFormat } from '@/lib/fileinfo';
import { usePlayer } from '@/components/Player';
import CoverMenu from '@/components/CoverMenu';
import ShareButton from '@/components/ShareButton';

const BINS = 100;
const PLAY = <path d="M7 4.5v15l13-7.5z" />;
const PAUSE = <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />;

export default function SongPage() {
  const { id } = useParams();
  const { eng, email, session } = useApp();
  const [song, setSong] = useState(undefined);
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [plays, setPlays] = useState([]);
  const [vid, setVid] = useState(null);
  const [tab, setTab] = useState('notes');
  const [msg, setMsg] = useState('');

  // playback goes through the app-wide player, so it keeps going when you leave this page
  const pl = usePlayer();
  const isCur = pl.current?.song?.id === id;
  const playing = isCur && pl.playing;
  const time = isCur ? pl.time : 0;
  const dur = isCur ? pl.duration : 0;
  const [queueIds, setQueueIds] = useState([]);

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: s } = await sb.from('songs').select('*, projects(*)').eq('id', id).single();
    if (!s) { setSong(null); return; }
    const [{ data: vs }, { data: ns }, { data: us }] = await Promise.all([
      sb.from('versions').select('*').eq('song_id', id).order('created_at'),
      sb.from('notes').select('*').eq('song_id', id).order('created_at'),
      sb.from('updates').select('*').eq('song_id', id).order('created_at', { ascending: false }),
    ]);
    const list = orderVersions(vs || []);
    setSong(s); setVersions(list); setNotes(ns || []); setUpdates(us || []);
    const nids = (ns || []).map((n) => n.id);
    if (nids.length) sb.from('note_reactions').select('note_id, emoji, who').in('note_id', nids).then(({ data, error }) => setReactions(error ? [] : data || []));
    else setReactions([]);
    sb.from('songs').select('id').eq('project_id', s.project_id).order('position').then(({ data }) => setQueueIds((data || []).map((x) => x.id)));
    pl.refresh(id, list);
    if (list.length) {
      const top = mixesOf(list).at(-1) || list[list.length - 1];
      const asked = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('v') : null; // from a version stack link
      setVid((cur) => (cur && list.some((v) => v.id === cur) ? cur : asked && list.some((v) => v.id === asked) ? asked : top.id));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!eng) return;
    supabase().from('plays').select('*').eq('song_id', id).order('updated_at', { ascending: false }).then(({ data }) => setPlays(data || []));
  }, [eng, id, song]);

  const inv = useInvoices(song?.project_id);
  const locked = !eng && !!lockingInvoice(inv.list);
  const v = versions.find((x) => x.id === vid) || null;
  const p = song?.projects;

  /* ---------- controls (app-wide player) ---------- */
  useEffect(() => { if (isCur && pl.current.versionId !== vid) setVid(pl.current.versionId); }, [isCur, pl.current?.versionId]); // eslint-disable-line
  const start = (at = 0, versionId = vid) => pl.play({ song, project: p, versions, versionId, at, queue: queueIds.length ? queueIds : [id] });
  const toggle = () => (locked ? setMsg('Mixes unlock once the invoice is paid.') : isCur ? pl.toggle() : start(0));
  const seek = (t) => (isCur ? pl.seek(t) : start(t));
  const prevVid = useRef(null);
  const switchTo = (newId) => {
    if (!newId || newId === vid) return;
    prevVid.current = vid;
    setVid(newId);
    if (isCur) pl.switchVersion(newId);
    document.querySelector('.bigdisc')?.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-28deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 550, easing: 'cubic-bezier(.3,.7,.3,1)' });
  };
  // X jumps back to the version you were just on (same spot in the song)
  const flip = () => { const back = prevVid.current && versions.some((x) => x.id === prevVid.current) ? prevVid.current : null; if (back) switchTo(back); };

  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('textarea,input,select,[contenteditable]')) return;
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
          <div className="bigdisc hascm">
            <Cover as="div" {...artOf(song, song.projects)} size={640} className="art spin" />
            {eng && <CoverMenu table="songs" row={song} onChange={load} className="ondisc" />}
            <div className="arm" aria-hidden="true"><svg viewBox="0 0 100 170">
              <circle cx="80" cy="14" r="13" fill="#1d1d20" stroke="#3a3a40" strokeWidth="2" />
              <circle cx="80" cy="14" r="5" fill="#9a9aa2" />
              <path d="M80 14 C 78 60, 62 110, 44 140" fill="none" stroke="#d6d6db" strokeWidth="4.5" strokeLinecap="round" />
              <rect x="30" y="136" width="22" height="30" rx="4" fill="#ececef" transform="rotate(28 41 151)" />
              <rect x="34" y="150" width="6" height="8" rx="1.5" fill="#f5d547" transform="rotate(28 41 151)" />
            </svg></div>
            <button className="hub" onClick={toggle} disabled={!v} aria-label={playing ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playing ? PAUSE : PLAY}</svg></button>
          </div>
          <div className="sinfo">
            <p className="eyebrow"><Link href={`/p/${p.id}`}>{p.title}</Link> · {p.artist}</p>
            <SongTitle song={song} eng={eng} reload={load} />
            <div className="meta"><span className={`dot ${song.status}`}>{statusText(song, versions)}</span>
              {eng ? <>
                <InlineText value={song.bpm ? String(song.bpm) : ''} placeholder="BPM" suffix=" BPM" width={4} inputMode="decimal" label="BPM"
                  onSave={async (t) => { const n = Number(String(t).replace(',', '.')); if (t && !(n > 20 && n < 400)) return setMsg('BPM should be a number like 92 or 140.'); await supabase().from('songs').update({ bpm: t ? Math.round(n * 10) / 10 : null }).eq('id', song.id); load(); }} />
                <InlineText value={song.musical_key || ''} placeholder="Key" width={8} label="Key"
                  onSave={async (t) => { await supabase().from('songs').update({ musical_key: t || null }).eq('id', song.id); load(); }} />
              </> : [song.bpm ? `${song.bpm} BPM` : '', song.musical_key].filter(Boolean).map((x) => <span key={x}>{x}</span>)}
              <span>{[mixesOf(versions).length ? `${mixesOf(versions).length} version${mixesOf(versions).length > 1 ? 's' : ''}${demoOf(versions) ? ' + demo' : ''}` : demoOf(versions) ? 'Demo only' : ''].filter(Boolean).join(' · ')}</span></div>
            {hasMix && <div className="shbar"><ShareButton kind="song" id={song.id} eng={eng} title={song.title} /></div>}
            {v?.note && <p className="vnote">{v.label}: {v.note}</p>}
            {eng && <DeliverVersion song={song} versions={versions} onDone={load} setMsg={setMsg} />}
            {!demoOf(versions) && <AddDemo song={song} eng={eng} onDone={load} setMsg={setMsg} />}
            {msg && <p className="upmsg">{msg}</p>}
            {mixesOf(versions).length > 0 && <Decision {...{ eng, song, v, versions, notes, reload: load, setMsg, setTab }} />}
          </div>
        </div>

        {!eng && <InvoiceNotice list={inv.list} />}
        {hasMix && locked ? (
          <div className="nomix lockedmix"><strong className="up">Locked until paid</strong>Your mixes are ready. They unlock as soon as the invoice above is paid.</div>
        ) : hasMix ? (
          <Scrub {...{ v, notes, time, dur: dur || v?.duration || 0, seek, eng, plays }}
            header={<VersionPicker {...{ versions, vid, switchTo, eng, song, reload: load, setMsg, time, dur: dur || v?.duration || 0 }} />} />
        ) : (
          <div className="nomix"><strong className="up">No mix yet</strong>{song.eta ? `The first mix is expected ${fmtDate(song.eta)}.` : 'The first mix will show up here.'}{p.phone ? " You'll get a text the moment it's ready." : ''}</div>
        )}

        <div className="stabs" role="tablist" aria-label="Song details">
          {tabs.map(([k, l, c, hot]) => (
            <button key={k} className="stab" role="tab" aria-selected={k === curTab} onClick={() => setTab(k)}>{l}{c ? <span className={`cnt ${hot ? 'hot' : ''}`}>{c}</span> : null}</button>
          ))}
        </div>
        {curTab === 'notes' && <Notes {...{ notes, reactions, v, versions, time, playing, seek, setVid: switchTo, eng, email, meName: session?.user?.user_metadata?.name, song, reload: load }} />}
        {curTab === 'progress' && <Progress {...{ song, versions, eng, reload: load }} />}
        {curTab === 'updates' && <Updates {...{ updates, eng, song, p, reload: load }} />}
        {curTab === 'about' && <About {...{ song, eng, reload: load }} />}
        {curTab === 'activity' && <Listening {...{ plays, versions }} />}
      </section>
    </>
  );
}

/* ---------- versions timeline + A/B ---------- */

/* ---------- deliver a new version (engineer) ---------- */
function DeliverVersion({ song, versions, onDone, setMsg }) {
  const [busy, setBusy] = useState('');
  const [text, setText] = useState(true);
  const [hot, setHot] = useState(false);
  const inputId = `deliver-${song.id}`;
  // one or many files: each becomes its own version, in name order; the client gets one text at the end
  const deliverAll = async (list) => {
    const files = Array.from(list || []).filter((f) => f.size > 0 && /\.(wav|aiff?|mp3|m4a|flac)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) return setMsg('Drop WAV, AIFF, FLAC, MP3 or M4A files.');
    const done = [], failed = [];
    let current = versions, texted = false, aiff = false; const lossy = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i], last = i === files.length - 1;
      try {
        const r = await deliverFile({ song, versions: current, file: f, project: song.projects, text: text && last, onStatus: (m) => setBusy(files.length > 1 ? `${i + 1}/${files.length} · ${m}` : m) });
        done.push(`${r.label}${r.parsed.note ? ` (${r.parsed.note})` : ''}`);
        if (last) texted = r.texted;
        if (r.info?.file_format === 'AIFF') aiff = true;
        if (r.info?.lossless === false) lossy.push(f.name);
        const { data } = await supabase().from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
        current = data || current;
      } catch (err) { failed.push(`${f.name}: ${err.message}`); }
    }
    setBusy('');
    setMsg([
      done.length ? `Delivered ${done.join(', ')}.` : '',
      done.length && text ? (texted ? 'Texted the client.' : '(Text not sent. Check the phone number and Twilio setup.)') : '',
      done.length ? 'Tap ✎ to rename a version.' : '',
      aiff ? 'Heads up: Chrome and Android can’t play AIFF. WAV plays everywhere.' : '',
      lossy.length ? `${lossy.join(', ')} ${lossy.length > 1 ? 'are' : 'is'} compressed, not lossless. Send a WAV, AIFF or FLAC for the Lossless badge.` : '',
      failed.length ? `Couldn’t deliver ${failed.join('; ')}` : '',
    ].filter(Boolean).join(' '));
    if (done.length) onDone();
  };
  return (
    <div className={`row-actions deliverbox ${hot ? 'hot' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); setHot(false); if (!busy) deliverAll(e.dataTransfer?.files); }}>
      <label className="btn small" htmlFor={inputId} style={{ cursor: 'pointer' }}>{busy || (hot ? 'Drop to deliver' : '+ Deliver new versions')}</label>
      <input id={inputId} className="vh" type="file" multiple accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; deliverAll(l); }} disabled={!!busy} />
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
    return <div className="decision"><span className="grow">{song.status === 'approved' ? <><b>{ap?.label} is signed off.</b> You're clear to print final masters.</> : song.status === 'changes' ? <><b>The client asked for changes.</b> Their notes are in the Notes tab.</> : `Waiting on the client to review ${latestMix(versions)?.label}.`}</span></div>;
  }
  const latest = latestMix(versions);
  if (isDemo(v)) {
    return <div className="decision"><span className="grow"><b>This is the demo,</b> the starting point. Flip to {latest?.label || 'a mix'} to hear how far it’s come.</span></div>;
  }
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
function Scrub({ v, notes, time, dur, seek, eng, plays, header = null }) {
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
  return (
    <div className="scrub">
      {header}
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
      <div className="times"><span className="mono">{fmt(time)}</span><span className="mono fmtinfo" title="Played straight from the uploaded file: no compression, no limiting, no volume changes."><QualityBadge v={v} size="md" showLossy />{" "}{describeFormat(v) ? <><b>{describeFormat(v)}</b> · {v.lossless === false ? 'as uploaded, no extra compression' : 'original, untouched'}</> : 'Original file, untouched'}{v?.peak_db != null ? ` · Peak ${v.peak_db} dBFS` : ''}</span><span className="mono">{fmt(dur)}</span></div>
    </div>
  );
}

/* ---------- notes ---------- */
function Notes({ notes, reactions, v, versions, time, playing, seek, setVid, eng, email, meName, song, reload }) {
  const [filter, setFilter] = useState('this');
  const [mode, setMode] = useState('time');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(null);
  const [end, setEnd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = String(email || '').toLowerCase();
  const at = pinned != null ? pinned : time;
  const list = notes.filter((n) => filter === 'all' || n.version_id === v?.id || (n.parent_id && notes.find((p) => p.id === n.parent_id)?.version_id === v?.id))
    .sort((a, b) => (a.t ?? -1) - (b.t ?? -1) || a.created_at.localeCompare(b.created_at));
  const label = (vid) => versions.find((x) => x.id === vid)?.label || '';
  const nums = {};
  notes.filter((n) => n.version_id === v?.id && n.t != null && !n.parent_id).sort((a, b) => a.t - b.t).forEach((n, i) => { nums[n.id] = i + 1; });
  const myName = eng ? (meName ? `${meName} (Engineer)` : 'Engineer') : meName || null;
  const sqlHint = (m) => (/parent_id|t_end|note_reactions/.test(String(m)) ? 'Replies and reactions need a quick database update: run supabase/010_comments.sql in Supabase.' : m);
  const insert = async (row) => {
    let { error } = await supabase().from('notes').insert(row);
    if (error && /t_end|parent_id|guest/.test(error.message) && !row.parent_id) { const { t_end, ...old } = row; ({ error } = await supabase().from('notes').insert(old)); }
    if (error) setErr(sqlHint(error.message)); else setErr('');
    return !error;
  };
  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const t = mode === 'time' ? Math.round(at * 10) / 10 : null;
    const ok = await insert({ song_id: song.id, version_id: v?.id || null, t, t_end: t != null && end != null && end > t ? Math.round(end * 10) / 10 : null, body: body.trim(), author_name: myName, from_client: !eng });
    setBusy(false);
    if (ok) { setBody(''); setPinned(null); setEnd(null); reload(); }
  };
  const actions = {
    reply: async (parent, text) => { if (await insert({ song_id: song.id, version_id: parent.version_id, parent_id: parent.id, t: null, body: text, author_name: myName, from_client: !eng })) reload(); },
    react: async (n, emoji, on) => {
      const sb = supabase();
      const { error } = on ? await sb.from('note_reactions').insert({ note_id: n.id, emoji, who: me }) : await sb.from('note_reactions').delete().eq('note_id', n.id).eq('emoji', emoji).eq('who', me);
      if (error && !/duplicate/i.test(error.message)) setErr(sqlHint(error.message)); else reload();
    },
    resolve: async (n) => { await supabase().from('notes').update({ resolved: !n.resolved }).eq('id', n.id); reload(); },
    remove: async (n) => { const { error } = await supabase().from('notes').delete().eq('id', n.id); if (error) setErr(error.message); reload(); },
  };
  const nameOf = (n) => {
    if (n.author_email && n.author_email.toLowerCase() === me) return 'You';
    if (n.author_name) return n.author_name;
    if (!n.from_client) return eng ? 'You' : 'Your engineer';
    return (n.author_email || 'Client').split('@')[0];
  };
  return (
    <section>
      <div className="boxhead">
        <div className="tabs" role="group" aria-label="Which notes">
          <button aria-pressed={filter === 'this'} onClick={() => setFilter('this')}>This version ({notes.filter((n) => n.version_id === v?.id && !n.parent_id).length})</button>
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({notes.filter((n) => !n.parent_id).length})</button>
        </div>
      </div>
      <div className="composer">
        <textarea rows={2} value={body} placeholder={mode === 'time' ? 'Comment on this moment, like “love the delay on the guitar here.”' : 'Comment on the whole mix, like “overall it could be louder.”'}
          onChange={(e) => { setBody(e.target.value); if (mode === 'time' && pinned == null && e.target.value.trim()) setPinned(time); if (!e.target.value.trim()) { setPinned(null); setEnd(null); } }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }} aria-label="Comment" />
        <div className="row2">
          <span className="pin">
            <span className="nmode" role="group" aria-label="Comment type">
              <button aria-pressed={mode === 'time'} data-mode="time" onClick={() => { setMode('time'); if (body.trim()) setPinned(time); }}>At <span className="mono">{fmt(at)}</span>{end != null && end > at ? <> – <span className="mono">{fmt(end)}</span></> : null}</button>
              <button aria-pressed={mode === 'general'} data-mode="general" onClick={() => { setMode('general'); setEnd(null); }}>General</button>
            </span>
            {mode === 'time' && pinned != null && time > at + 0.5 && <button className="repin" onClick={() => setEnd(time)}>{end != null ? `End at ${fmt(time)}` : `Add end · ${fmt(time)}`}</button>}
            {mode === 'time' && end != null && <button className="repin" onClick={() => setEnd(null)}>No end</button>}
            {mode === 'time' && pinned != null && <button className="repin" onClick={() => { setPinned(time); setEnd(null); }}>Start from now</button>}
          </span>
          <button className="post" onClick={post} disabled={!body.trim() || busy}>{mode === 'time' ? `Post at ${fmt(at)}${end != null && end > at ? `–${fmt(end)}` : ''}` : 'Post'}</button>
        </div>
      </div>
      {err && <p className="ferr">{err}</p>}
      {list.some((n) => !n.parent_id) ? (
        <CommentList notes={list} reactions={reactions} me={me} nameOf={nameOf} canResolve={eng}
          canDelete={(n) => eng || (n.author_email && n.author_email.toLowerCase() === me)}
          actions={actions} numbers={nums} versionLabel={filter === 'all' ? label : null}
          seek={(t, vid) => { if (vid && vid !== v?.id) setVid(vid); seek(t); }} />
      ) : <p className="cempty">No comments on this version yet. Press play and type when something catches your ear.</p>}
    </section>
  );
}

/* ---------- progress ---------- */
function Progress({ song, versions, eng, reload }) {
  const sb = supabase();
  const mixes = mixesOf(versions), first = mixes[0], last = mixes.at(-1);
  const steps = [
    ['Files received', song.received_at], ['Files downloaded', song.downloaded_at], ['Mixing', song.mixing_at],
    [last && mixes.length > 1 ? `Delivered ${last.label}` : 'Mix delivered', last?.created_at], ['Approved', song.status === 'approved' ? song.approved_at : null],
  ];
  const cur = steps.findIndex((s) => !s[1]);
  const next = mixes.length ? nextLabel(versions) : 'First mix';
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
  // listen map per version: which parts of the song the client actually heard
  const maps = [...versions].reverse().map((ver) => {
    const h = new Array(BINS).fill(0);
    plays.filter((x) => x.version_id === ver.id && x.bins).forEach((x) => x.bins.split(',').forEach((n, i) => { h[i] += Number(n) || 0; }));
    return { ver, h, mx: Math.max(...h) };
  }).filter((m) => m.mx > 0);
  return (
    <>
    {maps.length > 0 && (
      <div className="lmaps">
        {maps.map(({ ver, h, mx }) => (
          <div key={ver.id} className="listenmap">
            <div className="lmlabel"><b>{ver.label}</b><span>Heard {Math.round((h.filter((x) => x > 0).length / BINS) * 100)}% · brighter = played more</span></div>
            <div className="lmbars">{h.map((x, i) => <i key={i} style={{ opacity: x ? 0.18 + (0.82 * x) / mx : 0.06 }} />)}</div>
          </div>
        ))}
      </div>
    )}
    <ul className="act">
      {plays.length ? plays.map((x) => {
        const pct = x.duration ? Math.min(100, Math.round((x.listened / x.duration) * 100)) : 0;
        return (
          <li key={x.id} style={{ display: 'grid', gap: 6 }}>
            <span><b>{x.listener_email || (/share link/.test(x.source || '') ? 'Someone' : 'Client')}</b> played <span className="mono">{label(x.version_id)}</span> · {x.device || 'Unknown device'}{x.source ? ` · ${x.source}` : ''}</span>
            <span className="nlisten"><span className="nbar"><i style={{ width: `${pct}%` }} /></span><small className="mono">{mmss(x.listened)} of {mmss(x.duration)} · {pct}% · {ago(x.updated_at)}</small></span>
          </li>
        );
      }) : <li><span className="muted">No plays yet. You'll see each listen here: who, which version, what device, and how much they heard.</span></li>}
    </ul>
    </>
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

/* ---------- demo: the baseline every mix gets compared to ---------- */
function AddDemo({ song, eng, onDone, setMsg }) {
  const [busy, setBusy] = useState('');
  const [hot, setHot] = useState(false);
  const id = `demo-${song.id}`;
  const go = async (file) => {
    if (!file) return;
    if (!/\.(wav|aiff?|mp3|m4a|flac)$/i.test(file.name)) return setMsg('Pick a WAV, AIFF, FLAC, MP3 or M4A file for the demo.');
    try {
      const r = await uploadDemo({ songId: song.id, file, onStatus: setBusy });
      setMsg(`Added ${file.name} as the ${r.label}. Use “Compare to demo” to A/B it against any mix.`);
      onDone();
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  return (
    <div className={`row-actions deliverbox ${hot ? 'hot' : ''}`} onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); setHot(false); if (!busy) go(e.dataTransfer?.files?.[0]); }}>
      <label className="btn small quiet" htmlFor={id} style={{ cursor: 'pointer' }}>{busy || (hot ? 'Drop the demo' : '+ Add demo')}</label>
      <input id={id} className="vh" type="file" accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; go(f); }} />
      <span className="muted small">{eng ? 'The rough or demo the mixes get compared to.' : 'Got a rough or demo? Add it so you can compare every mix to it.'}</span>
    </div>
  );
}

/* ---------- version picker: a dropdown by the waveform, each version with its own little waveform ---------- */
function MiniWave({ peaks, progress = 0, active = false, w = 150, h = 30 }) {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const step = 2 * dpr, n = Math.floor(c.width / step);
    for (let i = 0; i < n; i++) {
      let p = 0.06;
      if (peaks?.length) { const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length)); p = 0; for (let j = a; j < b; j++) p = Math.max(p, peaks[j] || 0); }
      const bh = Math.max(dpr, Math.min(1, p) * c.height * 0.95);
      g.fillStyle = active && i / n < progress ? '#f5d547' : active ? '#d4d4d8' : '#6b6b73';
      g.fillRect(i * step, (c.height - bh) / 2, Math.max(1, dpr), bh);
    }
  }, [peaks, progress, active, w, h]);
  return <canvas ref={cv} className="miniwave" style={{ width: w, height: h }} aria-hidden="true" />;
}


function VersionPicker({ versions, vid, switchTo, eng, song, reload, setMsg, time, dur }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const cur = versions.find((x) => x.id === vid) || versions.at(-1);
  const latest = latestMix(versions);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const rename = async (ver, nl) => {
    if (!nl) return;
    if (versions.some((x) => x.id !== ver.id && x.label.toLowerCase() === nl.toLowerCase())) return setMsg(`There's already a version called ${nl}.`);
    const { error } = await supabase().from('versions').update({ label: nl.slice(0, 20) }).eq('id', ver.id);
    setMsg(error ? error.message : `Renamed ${ver.label} to ${nl}.`);
    reload();
  };
  const tags = (x) => [isDemo(x) ? 'Demo' : '', x.id === latest?.id ? 'Latest' : '', song.approved_version === x.id ? 'Approved' : ''].filter(Boolean);
  const prog = dur ? time / dur : 0;
  // (a plain function, not a component, so the box keeps focus while the player ticks)
  const name = (x) => (eng
    ? <InlineText key={`n-${x.id}`} value={x.label} onSave={(t) => rename(x, t)} width={3} label={`Name of ${x.label}`} className="vp-inl" />
    : <b>{x.label}</b>);
  if (!cur) return null;
  return (
    <div className="vpick2" ref={box}>
      <div className={`vp-trigger ${open ? 'open' : ''}`}>
        <span className="vp-lab">{name(cur)}{tags(cur).map((t) => <i key={t} className={`vp-tag ${t.toLowerCase()}`}>{t}</i>)}<QualityBadge v={cur} short /></span>
        <button className="vp-open" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label="Choose a version">
          <MiniWave peaks={cur.peaks} progress={prog} active w={180} h={24} />
          <span className="vp-count">{versions.length} version{versions.length === 1 ? '' : 's'}</span>
          <svg className="vp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <ul className="vp-list" role="listbox" aria-label="Versions">
          {[...versions].reverse().map((x) => (
            <li key={x.id} role="option" aria-selected={x.id === vid} className={`${x.id === vid ? 'on' : ''} ${isDemo(x) ? 'demo' : ''}`}
              onClick={() => { switchTo(x.id); setOpen(false); }}>
              <span className="vp-name">
                {name(x)}
                {tags(x).map((t) => <i key={t} className={`vp-tag ${t.toLowerCase()}`}>{t}</i>)}
                <QualityBadge v={x} short />
                <small>{[shortDate(x.created_at), x.duration ? mmss(x.duration) : '', eng && x.lufs != null ? `${x.lufs.toFixed(1)} LUFS` : '', x.note].filter(Boolean).join(' · ')}</small>
              </span>
              <MiniWave peaks={x.peaks} progress={x.id === vid ? prog : 0} active={x.id === vid} />
            </li>
          ))}
          <li className="vp-hint">{eng ? 'Hover a name and click to rename it. ' : ''}Switching keeps your spot. <kbd>X</kbd> jumps back.</li>
        </ul>
      )}
    </div>
  );
}

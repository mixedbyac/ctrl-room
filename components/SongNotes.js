'use client';
import { useEffect, useRef, useState } from 'react';
import { exportToLogic } from '@/lib/midimarkers';
import { emailArtistOn, setEmailArtist, notifyArtist } from '@/lib/notifyartist';
import { drawWave } from '@/lib/wavedraw';
import { pingPush } from '@/lib/pushclient';
import QualityBadge from '@/components/QualityBadge';
import CommentList from '@/components/Comments';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/format';
import { describeFormat } from '@/lib/fileinfo';

/* The waveform with note markers, and the notes (composer + list) for one version. Used on the song page and inline on project pages. */
export function Scrub({ v, notes, time, dur, seek, eng, plays, header = null }) {
  const cv = useRef(null), wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const drag = useRef(false);
  const peaks = v?.peaks || null;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    drawWave(c, { peaks, prog: dur ? time / dur : 0, hover });
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
          <button key={n.id} className={`mk ${n.resolved && eng ? 'done' : ''}`} style={{ left: `${(n.t / dur) * 100}%` }} title={`${fmt(n.t)} · ${n.body}`} onClick={() => seek(n.t)} aria-label={`Note ${i + 1} at ${fmt(n.t)}`}>{i + 1}</button>
        ))}
      </div>
      <div className="times"><span className="mono">{fmt(time)}</span><span className="mono fmtinfo" title="Played straight from the uploaded file: no compression, no limiting, no volume changes."><QualityBadge v={v} size="md" showLossy />{" "}{describeFormat(v) ? <><b>{describeFormat(v)}</b> · {v.lossless === false ? 'as uploaded, no extra compression' : 'original, untouched'}</> : 'Original file, untouched'}{v?.peak_db != null ? ` · Peak ${v.peak_db} dBFS` : ''}</span><span className="mono">{fmt(dur)}</span></div>
    </div>
  );
}

/* ---------- notes ---------- */
export function Notes({ notes, reactions, v, versions, time, playing, seek, setVid, eng, email, meName, song, reload }) {
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
  const [mailArtist, setMailArtist] = useState(true);
  useEffect(() => { setMailArtist(emailArtistOn()); }, []);
  const [mailed, setMailed] = useState('');
  const insert = async (row) => {
    let { data, error } = await supabase().from('notes').insert(row).select('id').single();
    if (error && /t_end|parent_id|guest/.test(error.message) && !row.parent_id) { const { t_end, ...old } = row; ({ data, error } = await supabase().from('notes').insert(old).select('id').single()); }
    if (error) setErr(sqlHint(error.message)); else setErr('');
    return error ? false : (data?.id || true);
  };
  // engineer: tell the artist by email (replies always do, new notes when the box is ticked)
  const tell = (id, isReply) => {
    if (!eng || typeof id !== 'string' || (!isReply && !mailArtist)) return;
    notifyArtist(id).then((r) => { if (r?.sent) { setMailed(isReply ? 'Reply emailed to the artist.' : 'Emailed to the artist.'); setTimeout(() => setMailed(''), 3500); } });
  };
  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const t = mode === 'time' ? Math.round(at * 10) / 10 : null;
    const ok = await insert({ song_id: song.id, version_id: v?.id || null, t, t_end: t != null && end != null && end > t ? Math.round(end * 10) / 10 : null, body: body.trim(), author_name: myName, from_client: !eng });
    setBusy(false);
    if (ok) { pingPush({ kind: 'note', songId: song.id, body: body.trim() }); tell(ok, false); setBody(''); setPinned(null); setEnd(null); reload(); }
  };
  const actions = {
    reply: async (parent, text) => { const id = await insert({ song_id: song.id, version_id: parent.version_id, parent_id: parent.id, t: null, body: text, author_name: myName, from_client: !eng }); if (id) { tell(id, true); reload(); } },
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
        {eng && <span className="logicacts">
          {true && <button className="logicbtn" title="Save the open notes as markers: drag the .mid file into your Logic session" onClick={() => { const k = exportToLogic({ song, notes, bpm: song.bpm }); if (!k) setErr('No open timed notes to turn into markers.'); }}>Logic markers</button>}
        </span>}
      </div>
      <div className="composer">
        <textarea rows={2} value={body} placeholder={mode === 'time' ? `Leave a comment at ${fmt(at)}…` : 'Leave a comment on the whole mix…'}
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
          {eng && <label className="mailart" title="Replies to the artist's notes are always emailed to them"><input type="checkbox" checked={mailArtist} onChange={(e) => { setMailArtist(e.target.checked); setEmailArtist(e.target.checked); }} /> Email the artist</label>}
          <button className="csend" onClick={post} disabled={!body.trim() || busy} aria-label={mode === 'time' ? `Post at ${fmt(at)}` : 'Post'} title={mode === 'time' ? `Post at ${fmt(at)}${end != null && end > at ? `–${fmt(end)}` : ''}` : 'Post'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
        </div>
      </div>
      {mailed && <p className="toast-inline">{mailed}</p>}
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


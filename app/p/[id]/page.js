'use client';
import QualityBadge from '@/components/QualityBadge';
import VersionStack, { StackIcon } from '@/components/VersionStack';
import { InvoicePanel, InvoiceNotice, useInvoices, lockingInvoice } from '@/components/Invoices';
import ShareButton from '@/components/ShareButton';
import EditableTitle from '@/components/EditableTitle';
import { measureVersion, needsMeasure } from '@/lib/measure';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmtDate, shortDate, statusText, mmss, latestMix, mixesOf } from '@/lib/format';
import { parseMixName, matchSong } from '@/lib/filename';
import { deliverFile } from '@/lib/deliver';
import { usePlayer } from '@/components/Player';
import CoverMenu from '@/components/CoverMenu';

export default function ProjectPage() {
  const { id } = useParams();
  const { eng, reloadProjects } = useApp();
  const [p, setP] = useState(undefined);
  const [panel, setPanel] = useState(null); // 'share' | 'edit' | 'add'
  const [renaming, setRenaming] = useState(null);
  const [stacks, setStacks] = useState({}); // song id -> open
  const [noteCounts, setNoteCounts] = useState({});
  const toggleStack = (sid) => setStacks((x) => ({ ...x, [sid]: !x[sid] }));
  const renameSong = async (song, raw) => {
    setRenaming(null);
    const t = String(raw || '').trim();
    if (!t || t === song.title) return;
    await supabase().from('songs').update({ title: t }).eq('id', song.id);
    load();
  };
  const pl = usePlayer();
  const inv = useInvoices(id);

  const load = useCallback(async () => {
    const sb = supabase();
    const cols = 'id,label,note,created_at,storage_path,file_name,duration,lufs,peak_db,rms_db,file_format,sample_rate,bit_depth,file_size,lossless';
    let { data, error } = await sb.from('projects').select(`*, songs(*, versions(${cols}))`).eq('id', id).single();
    if (error && /column/i.test(error.message)) ({ data } = await sb.from('projects').select('*, songs(*, versions(*))').eq('id', id).single()); // older database
    if (data) data.songs = (data.songs || []).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    setP(data || null);
    const ids = (data?.songs || []).map((x) => x.id);
    if (ids.length) {
      sb.from('notes').select('version_id').in('song_id', ids).then(({ data: ns }) => {
        const c = {}; (ns || []).forEach((n) => { if (n.version_id) c[n.version_id] = (c[n.version_id] || 0) + 1; });
        setNoteCounts(c);
      });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (p === undefined) return <><TopBar crumbs={[{ label: 'Loading…' }]} /><section className="page" /></>;
  if (p === null) return (
    <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Not found' }]} />
      <section className="page"><div className="empty-state"><strong>This project isn't available</strong>It may have been removed, or it's shared with a different email. Sign in with the email your engineer has for you.</div></section></>
  );

  const approved = p.songs.filter((s) => s.status === 'approved').length;
  const ready = p.songs.filter((s) => s.status === 'review').length;
  const firstPlayable = p.songs.find((s) => s.versions?.length);
  const queue = p.songs.filter((s) => s.versions?.length).map((s) => s.id);
  const playSong = (s) => {
    if (!eng && lockingInvoice(inv.list)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } // locked until the invoice is paid
    if (pl.current?.song?.id === s.id) return pl.toggle();
    pl.play({ songId: s.id, project: p, queue });
  };
  const projectPlaying = pl.playing && pl.current?.project?.id === p.id;
  const crumbs = eng ? [{ label: 'Home', href: '/' }, { label: p.title }] : [{ label: 'Projects', href: '/' }, { label: p.title }];

  return (
    <>
      <TopBar crumbs={crumbs} />
      <section className="page">
        <div className="phero">
          <div className="sleevewrap">
            <div className="record"><div className="vinyl spin"><Cover as="div" seed={p.seed} path={p.cover_path} size={240} className="lbl" /></div></div>
            <div className="sleeve hascm"><Cover seed={p.seed} path={p.cover_path} size={600} alt={`${p.title} cover`} />
              {eng && <CoverMenu table="projects" row={p} onChange={() => { load(); reloadProjects(); }} />}</div>
          </div>
          <div className="pinfo">
            <EditableTitle value={p.title} canEdit={eng} label="project" onSave={async (t) => { await supabase().from('projects').update({ title: t }).eq('id', p.id); load(); reloadProjects(); }} />
            <p className="psub">{p.artist} · {p.type} · {p.songs.length} song{p.songs.length === 1 ? '' : 's'} · {approved} approved{p.release ? ` · out ${fmtDate(p.release)}` : ''}</p>
            <div className="prow">
              {firstPlayable && <button className="bigplay" onClick={() => (pl.current?.project?.id === p.id ? pl.toggle() : playSong(firstPlayable))} aria-label={projectPlaying ? 'Pause' : 'Play the project'}>
                <svg viewBox="0 0 24 24">{projectPlaying ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg></button>}
              <ShareButton kind="project" id={p.id} eng={eng} title={p.title} />
              {!eng && <span className="chipnote">{ready ? `${ready} mix${ready > 1 ? 'es' : ''} waiting on you` : "You're all caught up"}</span>}
              {eng && <>
                <button className="gear" onClick={() => setPanel(panel === 'share' ? null : 'share')}>Client access</button>
                <button className="gear" onClick={() => setPanel(panel === 'invoice' ? null : 'invoice')}>Invoices{(inv.list || []).some((i) => i.status === 'unpaid') ? <span className="gdot" aria-label="unpaid" /> : null}</button>
                <button className="gear" onClick={() => setPanel(panel === 'mixes' ? null : 'mixes')}>+ Add mixes</button>
                <button className="gear" onClick={() => setPanel(panel === 'add' ? null : 'add')}>+ Add song</button>
                <button className="gear" onClick={() => setPanel(panel === 'edit' ? null : 'edit')}>Edit details</button>
              </>}
            </div>
          </div>
        </div>

        {eng && panel === 'share' && <SharePanel p={p} onSaved={load} />}
        {eng && panel === 'invoice' && <InvoicePanel project={p} firstSongId={p.songs[0]?.id} onChange={inv.load} />}
        {!eng && <InvoiceNotice list={inv.list} />}
        {eng && panel === 'mixes' && <AddMixes p={p} onSaved={load} />}
        {eng && panel === 'add' && <AddSong p={p} onSaved={() => { load(); setPanel(null); }} />}
        {eng && panel === 'edit' && <EditProject p={p} onSaved={() => { load(); reloadProjects(); setPanel(null); }} />}

        {p.songs.length > 0 && <TrackStats songs={p.songs} eng={eng} onMeasured={load} />}
        <div className={`rows ${eng ? 'wide' : 'simple'}`}>
          {p.songs.length > 0 && (
            <div className="rowhead" aria-hidden="true">
              <span>#</span><span>Title</span>
              {eng && <span>Ver</span>}<span className="c-len">Length</span>
              {eng && <><span title="Integrated loudness (EBU R128)">LUFS</span><span title="Sample peak, dBFS">Peak</span><span className="c-fmt">Format</span><span className="c-bpm">BPM</span><span className="c-key">Key</span><span /></>}
              <span />
            </div>
          )}
          {p.songs.length ? p.songs.map((s, i) => {
            const vs = [...(s.versions || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
            const last = latestMix(vs) || vs.at(-1); // a demo only shows when there's no mix yet
            const sub = vs.length ? statusText(s, vs) : s.eta ? `First mix ${fmtDate(s.eta)}` : statusText(s, vs);
            const fmtx = last ? fmtShort(last) : '';
            return (
              <div key={s.id} className="rowwrap"><div className={`row ${vs.length ? '' : 'nomix'} ${stacks[s.id] ? 'stackopen' : ''} ${pl.current?.song?.id === s.id ? 'cur' : ''} ${pl.current?.song?.id === s.id && pl.playing ? 'live' : ''}`} style={{ '--i': i }}>
                <button className="rplay" onClick={() => vs.length && playSong({ ...s, versions: vs })} disabled={!vs.length} aria-label={vs.length ? `Play ${s.title}` : 'No mix yet'}>
                  <span className="num">{i + 1}</span><svg viewBox="0 0 24 24">{pl.current?.song?.id === s.id && pl.playing ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
                  <span className="eq"><span /><span /><span /></span></button>
                <Link className="ropen" href={`/s/${s.id}`}>{eng && renaming === s.id
                  ? <input className="rowedit up" defaultValue={s.title} autoFocus maxLength={120} aria-label="Rename song" onClick={(e) => e.preventDefault()} onFocus={(e) => e.target.select()}
                      onBlur={(e) => renameSong(s, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.currentTarget.value = s.title; e.currentTarget.blur(); } }} />
                  : <span className="t up">{s.title}</span>}<span className="rsub"><span className={`dot ${s.status}`}>{sub}</span>{last ? <span>· {shortDate(last.created_at)}</span> : null}</span></Link>
                {eng && <span className="cell">{vs.length ? <button className={`vstackbtn ${stacks[s.id] ? 'on' : ''}`} onClick={() => toggleStack(s.id)} aria-expanded={!!stacks[s.id]} title={`${vs.length} version${vs.length > 1 ? 's' : ''}`}><StackIcon /><span>{last?.label}</span></button> : <span className="dim">—</span>}</span>}
                <span className="cell mono c-len">{last?.duration ? mmss(last.duration) : <span className="dim">—</span>}</span>
                {eng && <>
                  <span className="cell mono" title={last?.lufs != null ? `${last.lufs} LUFS integrated` : 'Not measured yet'}>{last?.lufs != null ? last.lufs.toFixed(1) : <span className="dim">—</span>}</span>
                  <span className={`cell mono ${last?.peak_db != null && last.peak_db > -0.1 ? 'hot' : ''}`} title={last?.peak_db != null ? `${last.peak_db} dBFS sample peak` : ''}>{last?.peak_db != null ? last.peak_db.toFixed(1) : <span className="dim">—</span>}</span>
                  <span className="cell mono c-fmt" title={[last?.file_name, fmtx].filter(Boolean).join(' · ')}>{last && (last.file_format || last.lossless != null) ? <QualityBadge v={last} short showLossy /> : <span className="dim">—</span>}</span>
                  <span className="cell mono c-bpm">{s.bpm || <span className="dim">—</span>}</span>
                  <span className="cell c-key">{s.musical_key || <span className="dim">—</span>}</span>
                  <button className="rpen" onClick={() => setRenaming(s.id)} disabled={renaming === s.id} aria-label={`Rename ${s.title}`} title="Rename">✎</button>
                </>}
                {!eng && vs.length > 0 ? <button className={`vstackbtn rmeta ${stacks[s.id] ? 'on' : ''}`} onClick={() => toggleStack(s.id)} aria-expanded={!!stacks[s.id]} title="Versions"><StackIcon /><span>{vs.length}</span></button>
                  : <Link className="rmeta" href={`/s/${s.id}`} tabIndex={-1} aria-hidden="true"><span className="chev">›</span></Link>}
              </div>
              {stacks[s.id] && <VersionStack song={s} project={p} versions={vs.map((v) => ({ ...v }))} noteCounts={noteCounts} eng={eng} queue={queue} onChange={load} />}
              </div>
            );
          }) : <div className="empty-state"><strong>No songs yet</strong>{eng ? 'Add a song above, or have the client send files through the Portal.' : 'Send your files through the Portal to get started.'}</div>}
        </div>
      </section>
    </>
  );
}

function SharePanel({ p, onSaved }) {
  const [email, setEmail] = useState(p.client_email || '');
  const [phone, setPhone] = useState(p.phone || '');
  const [msg, setMsg] = useState('');
  const link = typeof window !== 'undefined' ? `${window.location.origin}/p/${p.id}` : '';
  const save = async () => {
    const { error } = await supabase().from('projects').update({ client_email: email.trim().toLowerCase() || null, phone: phone.trim() || null }).eq('id', p.id);
    setMsg(error ? error.message : 'Saved. Anyone signing in with this email can open the project.');
    if (!error) onSaved();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setMsg('Link copied.'); } catch { setMsg('Copy the link above.'); } };
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <h3>Share with your client</h3>
      <p className="muted small" style={{ margin: 0 }}>They sign in with this email (no password), then see this project and every mix in it.</p>
      <div className="two">
        <div className="fld"><label htmlFor="sh-e">Client email</label><input id="sh-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="fld"><label htmlFor="sh-p">Client phone <span className="opt">for texts</span></label><input id="sh-p" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="share-link"><code>{link}</code><button className="btn small" onClick={copy}>Copy link</button><button className="btn small primary" onClick={save}>Save</button></div>
      {msg && <p className="toast-inline">{msg}</p>}
    </div>
  );
}

function AddSong({ p, onSaved }) {
  const [title, setTitle] = useState('');
  const [eta, setEta] = useState('');
  const [err, setErr] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setErr('Give the song a title.');
    const pos = p.songs.reduce((m, s) => Math.max(m, s.position), -1) + 1;
    const { error } = await supabase().from('songs').insert({ project_id: p.id, title: title.trim(), position: pos, eta: eta || null, seed: Math.floor(Math.random() * 1e9) });
    if (error) return setErr(error.message);
    onSaved();
  };
  return (
    <form className="panel inline-form" onSubmit={add} style={{ marginBottom: 24 }}>
      <div className="fld"><label htmlFor="as-t">Song title</label><input id="as-t" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="fld" style={{ flex: '0 1 200px' }}><label htmlFor="as-d">First mix due <span className="opt">optional</span></label><input id="as-d" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
      <button className="btn primary">Add song</button>
      {err && <p className="ferr" style={{ width: '100%' }}>{err}</p>}
    </form>
  );
}

function EditProject({ p, onSaved }) {
  const [f, setF] = useState({ title: p.title, artist: p.artist, type: p.type, release: p.release || '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase().from('projects').update({ title: f.title.trim(), artist: f.artist.trim(), type: f.type, release: f.release || null }).eq('id', p.id);
    if (error) return setErr(error.message);
    onSaved();
  };
  const shuffle = async () => { await supabase().from('projects').update({ seed: Math.floor(Math.random() * 1e9) }).eq('id', p.id); onSaved(); };
  const archive = async () => { await supabase().from('projects').update({ archived: !p.archived }).eq('id', p.id); onSaved(); };
  return (
    <form className="panel" onSubmit={save} style={{ marginBottom: 24 }}>
      <div className="two">
        <div className="fld"><label htmlFor="ep-t">Title</label><input id="ep-t" value={f.title} onChange={set('title')} /></div>
        <div className="fld"><label htmlFor="ep-a">Artist</label><input id="ep-a" value={f.artist} onChange={set('artist')} /></div>
        <div className="fld"><label htmlFor="ep-ty">Type</label><select id="ep-ty" value={f.type} onChange={set('type')}><option>Single</option><option>EP</option><option>Album</option><option>Mixtape</option></select></div>
        <div className="fld"><label htmlFor="ep-r">Release date</label><input id="ep-r" type="date" value={f.release} onChange={set('release')} /></div>
      </div>
      {err && <p className="ferr">{err}</p>}
      <div className="row-actions">
        <button className="btn primary">Save</button>
        <button type="button" className="btn" onClick={shuffle}>New cover</button>
        <button type="button" className="btn quiet" onClick={archive}>{p.archived ? 'Unarchive' : 'Archive project'}</button>
      </div>
    </form>
  );
}

function AddMixes({ p, onSaved }) {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState(false);
  const pick = (list) => {
    const files = Array.from(list || []).filter((f) => f.size > 0 && /\.(wav|aiff?|mp3|m4a|flac)$/i.test(f.name));
    setRows(files.map((file) => {
      const parsed = parseMixName(file.name, { artist: p.artist, project: p.title });
      const song = matchSong(p.songs, parsed.title);
      return { file, title: parsed.title || file.name.replace(/\.[^.]+$/, ''), label: parsed.label, note: parsed.note, songId: song?.id || null, state: 'ready' };
    }));
  };
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const go = async () => {
    setBusy(true);
    const sb = supabase();
    let pos = p.songs.reduce((m, s) => Math.max(m, s.position), -1);
    const created = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        setRow(i, { state: 'working' });
        let song = r.songId ? p.songs.find((s) => s.id === r.songId) : created[r.title.toLowerCase()] || matchSong(p.songs, r.title);
        if (!song) {
          const { data, error } = await sb.from('songs').insert({ project_id: p.id, title: r.title.trim(), position: ++pos, seed: Math.floor(Math.random() * 1e9) }).select('*').single();
          if (error) throw new Error(error.message);
          song = { ...data, versions: [] };
          created[r.title.toLowerCase()] = song;
        }
        const { data: vs } = await sb.from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
        const res = await deliverFile({ song, versions: vs || [], file: r.file, project: p, text, onStatus: (m) => setRow(i, { status: m }) });
        setRow(i, { state: 'done', status: `${song.title} · ${res.label}${res.texted ? ' · texted' : ''}` });
      } catch (e) {
        setRow(i, { state: 'error', status: e.message });
      }
    }
    setBusy(false);
    onSaved();
  };
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <h3>Add mixes</h3>
      <p className="muted small" style={{ margin: 0 }}>Drop bounces named however you like, e.g. “{p.artist} - Song Name - Mix 2.wav”. Each file goes to the matching song (or a new one), and “Mix 2” becomes v2.</p>
      <label className={`minidrop ${hot ? 'hot' : ''}`} style={{ cursor: 'pointer' }}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); pick(e.dataTransfer?.files); }}>
        <span className="mi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>
        <span className="mt"><b>{rows.length ? `${rows.length} mix${rows.length > 1 ? 'es' : ''} ready` : 'Drop mixes here, or click to choose'}</b><span>WAV, AIFF, MP3, M4A or FLAC</span></span>
        <input className="vh" type="file" multiple accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </label>
      {rows.length > 0 && (
        <>
          <ul className="act">
            {rows.map((r, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 70px', gap: 10, alignItems: 'center' }}>
                <span className="small muted" style={{ overflowWrap: 'anywhere' }}>{r.file.name}</span>
                {r.state === 'ready' ? (
                  <select className="sinput" value={r.songId || 'new'} onChange={(e) => setRow(i, { songId: e.target.value === 'new' ? null : e.target.value })} aria-label="Which song">
                    <option value="new">New song: {r.title}</option>
                    {p.songs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                ) : <span className="small" style={{ color: r.state === 'error' ? 'var(--warn)' : r.state === 'done' ? 'var(--ok)' : 'var(--muted)' }}>{r.status}</span>}
                <span className="mono small">{r.label || 'next'}</span>
              </li>
            ))}
          </ul>
          <div className="row-actions">
            <button className="btn primary" onClick={go} disabled={busy || rows.every((r) => r.state === 'done')}>{busy ? 'Delivering…' : `Deliver ${rows.length} mix${rows.length > 1 ? 'es' : ''}`}</button>
            <label className="smsopt"><input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Text the client</label>
            {!busy && <button className="btn quiet" onClick={() => setRows([])}>Clear</button>}
          </div>
        </>
      )}
    </div>
  );
}

const fmtShort = (v) => {
  if (!v?.file_format && !v?.sample_rate) return '';
  const kHz = v.sample_rate ? `${(v.sample_rate / 1000).toFixed(v.sample_rate % 1000 ? 1 : 0)}k` : '';
  const bits = v.bit_depth ? (v.bit_depth < 0 ? `${-v.bit_depth}f` : `${v.bit_depth}`) : '';
  return [v.file_format, [bits, kHz].filter(Boolean).join('/')].filter(Boolean).join(' ');
};

/** Totals across the project's current mixes, plus a one-click loudness measure for mixes uploaded before LUFS existed. */
function TrackStats({ songs, eng, onMeasured }) {
  const [busy, setBusy] = useState('');
  const latest = songs.map((s) => latestMix(s.versions || [])).filter(Boolean);
  const total = latest.reduce((n, v) => n + (v.duration || 0), 0);
  const lu = latest.map((v) => v.lufs).filter((x) => x != null);
  const pk = latest.map((v) => v.peak_db).filter((x) => x != null);
  const tried = (() => { try { return JSON.parse(localStorage.getItem('ctrl-room:measured') || '[]'); } catch { return []; } })();
  const todo = songs.map((s) => ({ s, v: latestMix(s.versions || []) }))
    .filter((x) => x.v && !tried.includes(x.v.id) && (needsMeasure(x.v) || !x.s.bpm || !x.s.musical_key));
  const started = useRef(false);
  // older mixes get measured in the background the first time you open the project (engineer only)
  useEffect(() => {
    if (!eng || started.current || !todo.length) return;
    started.current = true;
    (async () => {
      for (let i = 0; i < todo.length; i++) {
        setBusy(`Measuring ${i + 1} of ${todo.length}…`);
        try { await measureVersion(todo[i].v, todo[i].s); } catch { /* skip files that can't be read */ }
        try { localStorage.setItem('ctrl-room:measured', JSON.stringify([...tried, todo[i].v.id].slice(-500))); tried.push(todo[i].v.id); } catch {}
      }
      setBusy('');
      onMeasured();
    })();
  }, [eng, todo.length]); // eslint-disable-line
  const parts = [];
  if (total) parts.push(`${latest.length} mix${latest.length === 1 ? '' : 'es'} · ${mmss(total)} total`);
  if (eng && lu.length) parts.push(lu.length > 1 ? `${Math.min(...lu).toFixed(1)} to ${Math.max(...lu).toFixed(1)} LUFS · ${(Math.max(...lu) - Math.min(...lu)).toFixed(1)} LU spread` : `${lu[0].toFixed(1)} LUFS`);
  if (eng && pk.length) parts.push(`peaks up to ${Math.max(...pk).toFixed(1)} dBFS`);
  if (!parts.length && !busy) return null;
  return (
    <div className="tstats">
      <span className="mono">{parts.join('  ·  ')}</span>
      {eng && busy && <span className="muted small">{busy}</span>}
    </div>
  );
}

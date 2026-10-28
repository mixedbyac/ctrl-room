'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmtDate, shortDate, statusText } from '@/lib/format';
import { parseMixName, matchSong } from '@/lib/filename';
import { deliverFile } from '@/lib/deliver';
import { usePlayer } from '@/components/Player';
import CoverMenu from '@/components/CoverMenu';

export default function ProjectPage() {
  const { id } = useParams();
  const { eng, reloadProjects } = useApp();
  const [p, setP] = useState(undefined);
  const [panel, setPanel] = useState(null); // 'share' | 'edit' | 'add'
  const pl = usePlayer();

  const load = useCallback(async () => {
    const { data } = await supabase().from('projects').select('*, songs(*, versions(id,label,created_at))').eq('id', id).single();
    if (data) data.songs = (data.songs || []).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    setP(data || null);
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
            <h1 className="up">{p.title}</h1>
            <p className="psub">{p.artist} · {p.type} · {p.songs.length} song{p.songs.length === 1 ? '' : 's'} · {approved} approved{p.release ? ` · out ${fmtDate(p.release)}` : ''}</p>
            <div className="prow">
              {firstPlayable && <button className="bigplay" onClick={() => (pl.current?.project?.id === p.id ? pl.toggle() : playSong(firstPlayable))} aria-label={projectPlaying ? 'Pause' : 'Play the project'}>
                <svg viewBox="0 0 24 24">{projectPlaying ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg></button>}
              {!eng && <span className="chipnote">{ready ? `${ready} mix${ready > 1 ? 'es' : ''} waiting on you` : "You're all caught up"}</span>}
              {eng && <>
                <button className="gear" onClick={() => setPanel(panel === 'share' ? null : 'share')}>Share with client</button>
                <button className="gear" onClick={() => setPanel(panel === 'mixes' ? null : 'mixes')}>+ Add mixes</button>
                <button className="gear" onClick={() => setPanel(panel === 'add' ? null : 'add')}>+ Add song</button>
                <button className="gear" onClick={() => setPanel(panel === 'edit' ? null : 'edit')}>Edit details</button>
              </>}
            </div>
          </div>
        </div>

        {eng && panel === 'share' && <SharePanel p={p} onSaved={load} />}
        {eng && panel === 'mixes' && <AddMixes p={p} onSaved={load} />}
        {eng && panel === 'add' && <AddSong p={p} onSaved={() => { load(); setPanel(null); }} />}
        {eng && panel === 'edit' && <EditProject p={p} onSaved={() => { load(); reloadProjects(); setPanel(null); }} />}

        <div className="rows">
          {p.songs.length ? p.songs.map((s, i) => {
            const vs = [...(s.versions || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
            const last = vs.at(-1);
            const sub = vs.length ? statusText(s, vs) : s.eta ? `First mix ${fmtDate(s.eta)}` : statusText(s, vs);
            return (
              <div key={s.id} className={`row ${vs.length ? '' : 'nomix'} ${pl.current?.song?.id === s.id ? 'cur' : ''} ${pl.current?.song?.id === s.id && pl.playing ? 'live' : ''}`} style={{ '--i': i }}>
                <button className="rplay" onClick={() => vs.length && playSong({ ...s, versions: vs })} disabled={!vs.length} aria-label={vs.length ? `Play ${s.title}` : 'No mix yet'}>
                  <span className="num">{i + 1}</span><svg viewBox="0 0 24 24">{pl.current?.song?.id === s.id && pl.playing ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
                  <span className="eq"><span /><span /><span /></span></button>
                <Link className="ropen" href={`/s/${s.id}`}><span className="t up">{s.title}</span><span className="rsub"><span className={`dot ${s.status}`}>{sub}</span>{last ? <span>· {shortDate(last.created_at)}</span> : null}</span></Link>
                <Link className="rmeta" href={`/s/${s.id}`} tabIndex={-1} aria-hidden="true">{last ? <span className="vtag">{last.label}</span> : null}<span className="chev">›</span></Link>
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

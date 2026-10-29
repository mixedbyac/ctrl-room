'use client';
import NotifyClient from '@/components/NotifyClient';
import ArtistName from '@/components/ArtistName';
import Credit, { useProfiles } from '@/components/Credit';
import { TitleInput, ArtistPicker, CaseButtons, CASES } from '@/components/TitleCase';
import QualityBadge from '@/components/QualityBadge';
import VersionStack, { StackIcon } from '@/components/VersionStack';
import { InvoicePanel, InvoiceNotice, useInvoices, lockingInvoice } from '@/components/Invoices';
import ShareButton from '@/components/ShareButton';
import EditableTitle from '@/components/EditableTitle';
import { measureVersion, needsMeasure } from '@/lib/measure';
import { selectWithVersions } from '@/lib/embed';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmtDate, shortDate, statusText, mmss, latestMix, mixesOf, currentMix, fmtBytes, todayISO } from '@/lib/format';
import { parseMixName, matchSong } from '@/lib/filename';
import { deliverFile } from '@/lib/deliver';
import { usePlayer } from '@/components/Player';
import CoverMenu from '@/components/CoverMenu';
import SongMenu, { CommentIcon } from '@/components/SongMenu';

export default function ProjectPage() {
  const { id } = useParams();
  const { eng, reloadProjects, canEditArtist } = useApp();
  const [p, setP] = useState(undefined);
  const [panel, setPanel] = useState(null); // 'share' | 'edit' | 'add'
  const [renaming, setRenaming] = useState(null);
  const { session } = useApp();
  const [savedCols, setSavedCols] = useState(() => {
    try { const l = JSON.parse(localStorage.getItem('ctrl-room:cols') || 'null'); if (Array.isArray(l)) return l; } catch {}
    return null;
  });
  useEffect(() => { const m = session?.user?.user_metadata?.ctrl_columns; if (Array.isArray(m)) setSavedCols(m); }, [session]);
  const dragSong = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [stacks, setStacks] = useState({}); // song id -> open
  const [fileOver, setFileOver] = useState(null); // song row a file is being dragged over
  const [pageOver, setPageOver] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [selMsg, setSelMsg] = useState('');
  const [selBusy, setSelBusy] = useState(false);
  const toggleSel = (sid) => setSel((x) => { const n = new Set(x); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const [noteCounts, setNoteCounts] = useState({});
  const toggleStack = (sid) => setStacks((x) => ({ ...x, [sid]: !x[sid] }));
  const renameSong = async (song, raw) => {
    setRenaming(null);
    const t = String(raw || '').trim();
    if (!t || t === song.title) return;
    if (!eng) await api('/api/admin', { action: 'title', songId: song.id, title: t }).catch(() => {});
    else await supabase().from('songs').update({ title: t }).eq('id', song.id);
    load();
  };
  const pl = usePlayer();
  const inv = useInvoices(id);

  const load = useCallback(async () => {
    const sb = supabase();
    const cols = 'id,label,note,created_at,storage_path,file_name,duration,lufs,peak_db,rms_db,file_format,sample_rate,bit_depth,file_size,lossless';
    let { data, error } = await selectWithVersions((V) => sb.from('projects').select(`*, songs(*, ${V}(${cols}))`).eq('id', id).single());
    if (error && /column/i.test(error.message)) ({ data, error } = await selectWithVersions((V) => sb.from('projects').select(`*, songs(*, ${V}(*))`).eq('id', id).single())); // older database
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
  // artist admins can edit art, order, titles and the active version (the engineer always can)
  const canEdit = eng || canEditArtist(p.artist);
  const viaAdmin = !eng && canEdit;
  const saveOrder = async (ids) => {
    setP((x) => ({ ...x, songs: ids.map((sid) => x.songs.find((y) => y.id === sid)).filter(Boolean) }));
    if (viaAdmin) { try { await api('/api/admin', { action: 'order', projectId: p.id, order: ids }); } catch (e) { alert(e.message); } }
    else await Promise.all(ids.map((sid, i) => supabase().from('songs').update({ position: i }).eq('id', sid)));
    load();
  };
  const moveSong = (i, dir) => {
    const ids = p.songs.map((x) => x.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveOrder(ids);
  };
  // which columns show: each person's own choice, saved to their account
  const availCols = ALL_COLS.filter((c) => !c.eng || eng);
  const shownCols = (savedCols || DEFAULT_COLS).filter((k) => availCols.some((c) => c.k === k));
  const cols = availCols.filter((c) => shownCols.includes(c.k));
  const tpl = ['52px', 'minmax(0, 1fr)', ...cols.map((c) => c.w), ...(canEdit ? ['78px'] : []), '96px'].join(' ');
  const saveCols = async (next) => {
    setSavedCols(next);
    try { localStorage.setItem('ctrl-room:cols', JSON.stringify(next)); } catch {}
    await supabase().auth.updateUser({ data: { ctrl_columns: next } }).catch(() => {});
  };
  const onDropRow = (targetId) => {
    const from = dragSong.current; dragSong.current = null; setDragOver(null);
    if (!from || from === targetId) return;
    const ids = p.songs.map((x) => x.id).filter((x) => x !== from);
    const at = ids.indexOf(targetId);
    ids.splice(at < 0 ? ids.length : at, 0, from);
    saveOrder(ids);
  };
  const playSong = (s) => {
    if (!eng && lockingInvoice(inv.list)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } // locked until the invoice is paid
    if (pl.current?.song?.id === s.id) return pl.toggle();
    pl.play({ songId: s.id, project: p, queue });
  };
  // comment from the tracklist: start the song if it isn't on, then pop the player up with the comment box
  const commentOn = async (s) => {
    if (!eng && lockingInvoice(inv.list)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (pl.current?.song?.id !== s.id) await pl.play({ songId: s.id, project: p, queue });
    pl.openComment();
  };
  // select songs: approve them all (client or engineer) or delete them (engineer)
  const pickedSongs = p.songs.filter((x) => sel.has(x.id));
  const approvable = pickedSongs.map((x) => ({ s: x, v: currentMix(x, x.versions || []) })).filter(({ s: x, v }) => v && !/^demo/i.test(v.label) && !(x.status === 'approved' && x.approved_version === v.id));
  const approveSelected = async () => {
    if (!approvable.length) return setSelMsg('Nothing to approve in what you picked (it’s already approved, or there’s no mix yet).');
    if (!window.confirm(`Approve ${approvable.length} song${approvable.length > 1 ? 's' : ''} as final? ${approvable.map(({ s: x, v }) => `${x.title} ${v.label}`).join(', ')}`)) return;
    setSelBusy(true); setSelMsg('');
    let ok = 0, bad = [];
    for (const { s: x, v } of approvable) {
      const { error } = await supabase().rpc('approve_version', { p_song: x.id, p_version: v.id });
      if (error) bad.push(`${x.title}: ${error.message}`); else ok++;
    }
    setSelBusy(false); setSel(new Set()); setSelecting(false);
    setSelMsg(bad.length ? `Approved ${ok}. Couldn’t approve ${bad.join('; ')}` : `Approved ${ok} song${ok > 1 ? 's' : ''}. Your engineer has been told.`);
    load();
  };
  const deleteSelected = async () => {
    if (!pickedSongs.length) return;
    if (!window.confirm(`Delete ${pickedSongs.length} song${pickedSongs.length > 1 ? 's' : ''} for good? Every version, note and file goes too. ${pickedSongs.map((x) => x.title).join(', ')}`)) return;
    setSelBusy(true); setSelMsg('');
    const sb = supabase();
    const paths = pickedSongs.flatMap((x) => (x.versions || []).map((v) => v.storage_path).filter(Boolean));
    if (paths.length) await sb.storage.from('mixes').remove(paths).catch(() => {});
    const { error } = await sb.from('songs').delete().in('id', pickedSongs.map((x) => x.id));
    setSelBusy(false); setSel(new Set()); setSelecting(false);
    setSelMsg(error ? error.message : `Deleted ${pickedSongs.length} song${pickedSongs.length > 1 ? 's' : ''}.`);
    load();
  };
  const projectPlaying = pl.playing && pl.current?.project?.id === p.id;
  const crumbs = eng ? [{ label: 'Home', href: '/' }, { label: p.title }] : [{ label: 'Projects', href: '/' }, { label: p.title }];

  return (
    <>
      <TopBar crumbs={crumbs} />
      <section className={`page ${pageOver ? 'filedrop' : ''}`}
        onDragOver={(e) => { if (eng && !dragSong.current && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setPageOver(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPageOver(false); }}
        onDrop={(e) => { if (eng && e.dataTransfer?.files?.length) { e.preventDefault(); setPageOver(false); window.dispatchEvent(new CustomEvent('ctrl-room:add-mixes', { detail: { files: [...e.dataTransfer.files] } })); } }}>
        {pageOver && <div className="pagedrop" aria-hidden="true"><b>Drop mixes</b><span>They go to the matching songs. Drop on a song to stack it as that song’s next version.</span></div>}
        <div className="phero">
          <div className="sleevewrap">
            <div className="record"><div className="vinyl spin"><Cover as="div" seed={p.seed} path={p.cover_path} size={240} className="lbl" /></div></div>
            <div className="sleeve hascm"><Cover seed={p.seed} path={p.cover_path} size={600} alt={`${p.title} cover`} />
              {canEdit && <CoverMenu table="projects" row={p} viaAdmin={viaAdmin} onChange={() => { load(); reloadProjects(); }} />}</div>
          </div>
          <div className="pinfo">
            <EditableTitle value={p.title} canEdit={canEdit} label="project" onSave={async (t) => { if (viaAdmin) await api('/api/admin', { action: 'title', projectId: p.id, title: t }); else await supabase().from('projects').update({ title: t }).eq('id', p.id); load(); reloadProjects(); }} />
            <p className="partist"><ArtistName name={p.artist} link /></p>
            <p className="psub">{p.songs.length} song{p.songs.length === 1 ? '' : 's'} · {approved} approved{p.release ? ` · out ${fmtDate(p.release)}` : ''}</p>
            <p className="pcredit"><Credit project={p} /></p>
            <Deadline p={p} eng={eng} onSaved={load} />
            <div className="prow">
              {firstPlayable && <button className="bigplay" onClick={() => (pl.current?.project?.id === p.id ? pl.toggle() : playSong(firstPlayable))} aria-label={projectPlaying ? 'Pause' : 'Play the project'}>
                <svg viewBox="0 0 24 24">{projectPlaying ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg></button>}
              <ShareButton kind="project" id={p.id} eng={eng} title={p.title} />
              {!eng && <span className="chipnote">{ready ? `${ready} mix${ready > 1 ? 'es' : ''} waiting on you` : "You're all caught up"}</span>}
              {eng && <AddPlus unpaid={(inv.list || []).some((i) => i.status === 'unpaid')} onPick={(k) => setPanel(panel === k ? null : k)} />}
            </div>
          </div>
        </div>

        {eng && panel === 'share' && <PanelShell onClose={() => setPanel(null)}><SharePanel p={p} onSaved={load} /></PanelShell>}
        {eng && panel === 'invoice' && <PanelShell onClose={() => setPanel(null)}><InvoicePanel project={p} firstSongId={p.songs[0]?.id} onChange={inv.load} /></PanelShell>}
        {!eng && <InvoiceNotice list={inv.list} />}
        {eng && <AddMixes p={p} onSaved={load} />}
        {eng && panel === 'add' && <PanelShell onClose={() => setPanel(null)}><AddSong p={p} onSaved={() => { load(); setPanel(null); }} /></PanelShell>}
        {eng && panel === 'edit' && <PanelShell onClose={() => setPanel(null)}><EditProject p={p} onSaved={() => { load(); reloadProjects(); setPanel(null); }} /></PanelShell>}

        {p.songs.length > 0 && <TrackStats songs={p.songs} eng={eng} onMeasured={load} />}
        {p.songs.length > 0 && <ColumnPicker cols={availCols} shown={shownCols} onChange={saveCols} />}
        {p.songs.length > 0 && (
          <div className={`selbar ${selecting ? 'on' : ''}`}>
            {!selecting ? (
              <button className="btn small quiet" onClick={() => { setSelecting(true); setSelMsg(''); }}>Select</button>
            ) : (
              <>
                <label className="selall"><input type="checkbox" checked={sel.size === p.songs.length} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && sel.size < p.songs.length; }}
                  onChange={(e) => setSel(e.target.checked ? new Set(p.songs.map((x) => x.id)) : new Set())} /> {sel.size ? `${sel.size} selected` : 'Select all'}</label>
                <span className="selacts">
                  <button className="btn small primary" disabled={!sel.size || selBusy} onClick={approveSelected}>{selBusy ? '…' : `Approve${sel.size ? ` ${sel.size}` : ''}`}</button>
                  {eng && <button className="btn small danger" disabled={!sel.size || selBusy} onClick={deleteSelected}>Delete{sel.size ? ` ${sel.size}` : ''}</button>}
                  <button className="btn small quiet" onClick={() => { setSelecting(false); setSel(new Set()); }}>Cancel</button>
                </span>
              </>
            )}
            {selMsg && <span className="toast-inline selmsg">{selMsg}</span>}
          </div>
        )}
        <div className={`rows dyn ${selecting ? 'selecting' : ''}`} style={{ '--tpl': tpl }}>
          {p.songs.length > 0 && (
            <div className="rowhead" aria-hidden="true">
              <span>#</span><span>Title</span>
              {cols.map((c) => <span key={c.k} data-col={c.k} title={c.tip || ''}>{c.label}</span>)}
              {canEdit && <span className="rtools" />}
              <span />
            </div>
          )}
          {p.songs.length ? p.songs.map((s, i) => {
            const vs = [...(s.versions || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
            const last = currentMix(s, vs) || vs.at(-1); // the active (or newest) mix; a demo only shows when there's no mix yet
            const sub = vs.length ? statusText(s, vs) : s.eta ? `First mix ${fmtDate(s.eta)}` : statusText(s, vs);
            const fmtx = last ? fmtShort(last) : '';
            const stackBtn = (extra = '') => (vs.length ? <button className={`vstackbtn ${extra} ${stacks[s.id] ? 'on' : ''}`} onClick={() => toggleStack(s.id)} aria-expanded={!!stacks[s.id]} title={`${vs.length} version${vs.length > 1 ? 's' : ''}`}><StackIcon /><span>{last?.label}</span></button> : null);
            const cell = {
              ver: <span key="ver" className="cell" data-col="ver">{stackBtn() || <span className="dim">—</span>}</span>,
              len: <span key="len" className="cell mono" data-col="len">{last?.duration ? mmss(last.duration) : <span className="dim">—</span>}</span>,
              fmt: <span key="fmt" className="cell mono" data-col="fmt" title={[last?.file_name, fmtx].filter(Boolean).join(' · ')}>{last && (last.file_format || last.lossless != null) ? <QualityBadge v={last} short showLossy /> : <span className="dim">—</span>}</span>,
              bpm: <span key="bpm" className="cell mono" data-col="bpm">{s.bpm || <span className="dim">—</span>}</span>,
              key: <span key="key" className="cell" data-col="key">{s.musical_key || <span className="dim">—</span>}</span>,
              lufs: <span key="lufs" className="cell mono" data-col="lufs" title={last?.lufs != null ? `${last.lufs} LUFS integrated` : 'Not measured yet'}>{last?.lufs != null ? last.lufs.toFixed(1) : <span className="dim">—</span>}</span>,
              peak: <span key="peak" className={`cell mono ${last?.peak_db != null && last.peak_db > -0.1 ? 'hot' : ''}`} data-col="peak" title={last?.peak_db != null ? `${last.peak_db} dBFS sample peak` : ''}>{last?.peak_db != null ? last.peak_db.toFixed(1) : <span className="dim">—</span>}</span>,
            };
            return (
              <div key={s.id} className={`rowwrap ${dragOver === s.id ? 'dragover' : ''} ${fileOver === s.id ? 'fileover' : ''}`} data-stack={`Drop to add as the next version of ${s.title}`} draggable={canEdit && renaming !== s.id}
                onDragStart={(e) => { if (!canEdit) return; dragSong.current = s.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); }}
                onDragOver={(e) => { if (dragSong.current) { e.preventDefault(); setDragOver(s.id); } else if (eng && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.stopPropagation(); setFileOver(s.id); setPageOver(false); } }} onDragLeave={() => { setDragOver((x) => (x === s.id ? null : x)); setFileOver((x) => (x === s.id ? null : x)); }}
                onDrop={(e) => { if (dragSong.current) { e.preventDefault(); onDropRow(s.id); } else if (eng && e.dataTransfer?.files?.length) { e.preventDefault(); e.stopPropagation(); setFileOver(null); setPageOver(false); window.dispatchEvent(new CustomEvent('ctrl-room:add-mixes', { detail: { files: [...e.dataTransfer.files], songId: s.id } })); } }} onDragEnd={() => { dragSong.current = null; setDragOver(null); }}><div className={`row ${vs.length ? '' : 'nomix'} ${stacks[s.id] ? 'stackopen' : ''} ${pl.current?.song?.id === s.id ? 'cur' : ''} ${pl.current?.song?.id === s.id && pl.playing ? 'live' : ''}`} style={{ '--i': i }}>
                {selecting ? (
                  <label className="rcheck"><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleSel(s.id)} aria-label={`Select ${s.title}`} /></label>
                ) : <button className="rplay" onClick={() => vs.length && playSong({ ...s, versions: vs })} disabled={!vs.length} aria-label={vs.length ? `Play ${s.title}` : 'No mix yet'}>
                  <span className="num">{i + 1}</span><svg viewBox="0 0 24 24">{pl.current?.song?.id === s.id && pl.playing ? <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
                  <span className="eq"><span /><span /><span /></span></button>}
                <Link className="ropen" href={`/s/${s.id}`} onClick={(e) => { if (selecting) { e.preventDefault(); toggleSel(s.id); return; } if (renaming === s.id) return e.preventDefault(); if (vs.length) { e.preventDefault(); playSong({ ...s, versions: vs }); } }}>{canEdit && renaming === s.id
                  ? <RowRename song={s} onDone={(t) => renameSong(s, t)} />
                  : <span className="t ttl">{s.title}</span>}<span className="rsub"><span className={`dot ${s.status}`}>{sub}</span>{last ? <span>· {shortDate(last.created_at)}</span> : null}</span></Link>
                {cols.map((c) => cell[c.k])}
                {canEdit && (
                  <span className="rtools">
                    <button onClick={() => moveSong(i, -1)} disabled={i === 0} aria-label={`Move ${s.title} up`} title="Move up">↑</button>
                    <button onClick={() => moveSong(i, 1)} disabled={i === p.songs.length - 1} aria-label={`Move ${s.title} down`} title="Move down">↓</button>
                    <button onClick={() => setRenaming(s.id)} disabled={renaming === s.id} aria-label={`Rename ${s.title}`} title="Rename">✎</button>
                  </span>
                )}
                <span className="rtrail">
                  {vs.length > 0 && (() => { const n = vs.reduce((m, v) => m + (noteCounts[v.id] || 0), 0); return (
                    <button className={`rcomment ${n ? '' : 'none'}`} onClick={() => commentOn({ ...s, versions: vs })} aria-label={`Comment on ${s.title}${n ? ` (${n} so far)` : ''}`} title="Add a comment"><CommentIcon />{n ? <span>{n}</span> : null}</button>); })()}
                  <SongMenu song={s} versions={vs} project={p} eng={eng} canEdit={canEdit} queue={queue} onChange={load}
                    onPlay={() => playSong({ ...s, versions: vs })} onComment={() => commentOn({ ...s, versions: vs })}
                    onVersions={() => toggleStack(s.id)} versionsOpen={!!stacks[s.id]} onRename={() => setRenaming(s.id)}
                    onMove={(d) => moveSong(i, d)} index={i} count={p.songs.length} />
                </span>
              </div>
              {stacks[s.id] && <VersionStack song={s} project={p} versions={vs.map((v) => ({ ...v }))} noteCounts={noteCounts} eng={eng} canEdit={canEdit} viaAdmin={viaAdmin} queue={queue} onChange={load} />}
              </div>
            );
          }) : <div className="empty-state"><strong>No songs yet</strong>{eng ? 'Add a song above, or have the client send files through the Portal.' : 'Send your files through the Portal to get started.'}</div>}
        </div>
        {eng && <NerdStuff songs={p.songs} />}
      </section>
    </>
  );
}

/** The project's final deadline: a chip with a countdown. The engineer taps it to set or change the date. */
function Deadline({ p, eng, onSaved }) {
  const due = p.settings?.due || '';
  const input = useRef(null);
  const [msg, setMsg] = useState('');
  const left = due ? Math.round((new Date(`${due}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000) : null;
  const done = p.songs.length > 0 && p.songs.every((s) => s.status === 'approved');
  const set = async (d) => {
    const settings = { ...(p.settings || {}) }; if (d) settings.due = d; else delete settings.due;
    const { error } = await supabase().from('projects').update({ settings }).eq('id', p.id);
    setMsg(error ? error.message : ''); if (!error) onSaved();
  };
  if (!due && !eng) return null;
  const tone = done ? 'done' : left == null ? 'none' : left < 0 ? 'late' : left <= 3 ? 'soon' : 'ok';
  const text = !due ? 'Add a final deadline' : done ? `Done · deadline was ${fmtDate(due)}` : left < 0 ? `${-left} day${left === -1 ? '' : 's'} late · was due ${fmtDate(due)}` : left === 0 ? 'Due today' : `Due ${fmtDate(due)} · ${left} day${left === 1 ? '' : 's'} left`;
  return (
    <span className={`deadline ${tone}`}>
      {eng ? (
        <label className="dlchip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          {text}
          <input ref={input} type="date" value={due} onChange={(e) => set(e.target.value)} aria-label="Final deadline" />
        </label>
      ) : <span className="dlchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>{text}</span>}
      {eng && due && <button className="dlclear" onClick={() => set('')} aria-label="Clear the deadline" title="Clear">✕</button>}
      {msg && <span className="ferr small">{msg}</span>}
    </span>
  );
}

/** Rename a song right in the tracklist, with the AA / Aa / A. / aa buttons. Enter saves, Esc cancels. */
function RowRename({ song, onDone }) {
  const [v, setV] = useState(song.title);
  return (
    <span className="rowrename titleedit-wrap" onClick={(e) => e.preventDefault()}>
      <input className="rowedit ttl" value={v} autoFocus maxLength={120} aria-label="Rename song" onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()}
        onBlur={() => onDone(v)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setV(song.title); onDone(song.title); } }} />
      <CaseButtons value={v} onChange={setV} className="floating" />
    </span>
  );
}

/** A window opened from the + menu: an ✕ in the corner, and clicking anywhere else (or Esc) closes it. */
function PanelShell({ onClose, children }) {
  const box = useRef(null);
  useEffect(() => {
    const off = (e) => {
      if (!box.current || box.current.contains(e.target)) return;
      if (e.target.closest('.addplus, .ctxmenu, .spop, .sharepop, .ccard')) return; // the + menu and other popups
      onClose();
    };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => document.addEventListener('pointerdown', off), 0); // not the tap that opened it
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div className="panelshell" ref={box}>
      <button type="button" className="panelx" onClick={onClose} aria-label="Close" title="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {children}
    </div>
  );
}

function AddPlus({ onPick, unpaid }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  const pick = (k) => { setOpen(false); onPick(k); };
  const Row = ({ k, icon, title, sub, dot }) => k === 'mixes'
    // a label opens the file picker in the same tap (Safari needs that)
    ? <label role="menuitem" htmlFor="addmix-file" className="pmlabel" onClick={() => setOpen(false)}><span className="pmi">{icon}</span><span><b>{title}</b><small>{sub}</small></span></label>
    : <button role="menuitem" onClick={() => pick(k)}><span className="pmi">{icon}</span><span><b>{title}{dot ? <span className="gdot" aria-label="unpaid" style={{ position: 'static', display: 'inline-block', marginLeft: 6 }} /> : null}</b><small>{sub}</small></span></button>;
  return (
    <span className="addplus" ref={box}>
      <button className="bigplus" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Add to this project" title="Add & manage">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      {unpaid && !open && <span className="gdot" aria-label="unpaid invoice" />}
      {open && (
        <div className="plusmenu" role="menu">
          <Row k="mixes" icon="↑" title="Add files / mixes" sub="Pick files, they go straight in (or drag them onto the page)" />
          <Row k="share" icon="@" title="Client access" sub="Who can open it, downloads" />
          <Row k="invoice" icon="$" title="Invoices" sub="Attach, show, lock until paid" dot={unpaid} />
          <Row k="edit" icon="✎" title="Edit details" sub="Title, artist, type, release" />
        </div>
      )}
    </span>
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
      <label className="invsw"><button type="button" className="switch" role="switch" aria-checked={!!p.allow_download} onClick={async () => {
        const { error } = await supabase().from('projects').update({ allow_download: !p.allow_download }).eq('id', p.id);
        setMsg(error ? (/allow_download/.test(error.message) ? 'Run supabase/015_downloads.sql in Supabase first.' : error.message) : !p.allow_download ? 'Downloads are on. The artist’s team can download mixes from the ⋯ menu.' : 'Downloads are off. They can listen, not download.');
        if (!error) onSaved();
      }}><i /></button>Allow downloads <span className="muted small">Off until you switch it on. Everyone on the team still has full access to listen, comment and approve.</span></label>
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
      <div className="fld"><label htmlFor="as-t">Song title</label><TitleInput id="as-t" value={title} onChange={setTitle} autoFocus /></div>
      <div className="fld" style={{ flex: '0 1 200px' }}><label htmlFor="as-d">First mix due <span className="opt">optional</span></label><input id="as-d" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
      <button className="btn primary">Add song</button>
      {err && <p className="ferr" style={{ width: '100%' }}>{err}</p>}
    </form>
  );
}

function EditProject({ p, onSaved }) {
  const [f, setF] = useState({ title: p.title, artist: p.artist, type: p.type, release: p.release || '', due: p.settings?.due || '', engineer: p.settings?.engineer || '' });
  const engineers = useProfiles();
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const settings = { ...(p.settings || {}) }; if (f.due) settings.due = f.due; else delete settings.due;
    if (f.engineer) settings.engineer = f.engineer; else delete settings.engineer;
    const { error } = await supabase().from('projects').update({ title: f.title.trim(), artist: f.artist.trim(), type: f.type, release: f.release || null, settings }).eq('id', p.id);
    if (error) return setErr(error.message);
    onSaved();
  };
  const shuffle = async () => { await supabase().from('projects').update({ seed: Math.floor(Math.random() * 1e9) }).eq('id', p.id); onSaved(); };
  const archive = async () => { await supabase().from('projects').update({ archived: !p.archived }).eq('id', p.id); onSaved(); };
  return (
    <form className="panel" onSubmit={save} style={{ marginBottom: 24 }}>
      <div className="two">
        <div className="fld"><label htmlFor="ep-t">Title</label><TitleInput id="ep-t" value={f.title} onChange={(v) => setF((x) => ({ ...x, title: v }))} /></div>
        <div className="fld"><label htmlFor="ep-a">Artist</label><ArtistPicker id="ep-a" value={f.artist} onChange={(v) => setF((x) => ({ ...x, artist: v }))} /></div>
        <div className="fld"><label htmlFor="ep-ty">Type</label><select id="ep-ty" value={f.type} onChange={set('type')}><option>Single</option><option>EP</option><option>Album</option><option>Mixtape</option></select></div>
        {engineers.length > 0 && <div className="fld"><label htmlFor="ep-en">Engineer <span className="opt">who’s credited</span></label><select id="ep-en" value={f.engineer} onChange={set('engineer')}><option value="">Main engineer</option>{engineers.map((x) => <option key={x.email} value={x.email}>{x.display_name || x.full_name || x.email}</option>)}</select></div>}
        <div className="fld"><label htmlFor="ep-d">Final deadline <span className="opt">everything done by</span></label><input id="ep-d" type="date" value={f.due} onChange={set('due')} /></div>
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

/**
 * Add mixes: the + menu opens your files right away. Every file you pick goes straight into the project
 * (matching song, or a new song named from the file). Pick more anytime. Then one tap emails the client.
 */
function AddMixes({ p, onSaved }) {
  const [rows, setRows] = useState([]); // { id, file, title, label, songId, state, status }
  const [done, setDone] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState(false);
  const input = useRef(null);
  const chain = useRef(Promise.resolve());
  const created = useRef({});
  const pos = useRef(null);
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const run = async (batch) => {
    setBusy(true);
    const sb = supabase();
    if (pos.current == null) pos.current = p.songs.reduce((m, s) => Math.max(m, s.position), -1);
    for (const r of batch) {
      try {
        setRow(r.id, { state: 'working', status: 'Starting…' });
        let song = r.songId ? p.songs.find((s) => s.id === r.songId) : created.current[r.title.toLowerCase()] || matchSong(p.songs, r.title);
        if (!song) {
          const { data, error } = await sb.from('songs').insert({ project_id: p.id, title: r.title.trim(), position: ++pos.current, seed: Math.floor(Math.random() * 1e9) }).select('*').single();
          if (error) throw new Error(error.message);
          song = { ...data, versions: [] };
          created.current[r.title.toLowerCase()] = song;
        }
        const { data: vs } = await sb.from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
        const res = await deliverFile({ song, versions: vs || [], file: r.file, project: p, text: false, onStatus: (m) => setRow(r.id, { status: m }) });
        setRow(r.id, { state: 'done', status: `${song.title} · ${res.label}` });
        setDone((d) => [...d, { songId: song.id, songTitle: song.title, label: res.label }]);
      } catch (e) { setRow(r.id, { state: 'error', status: e.message }); }
    }
    setBusy(false);
    onSaved();
  };
  useEffect(() => {
    const on = (e) => pick(e.detail?.files, e.detail?.songId);
    window.addEventListener('ctrl-room:add-mixes', on);
    return () => window.removeEventListener('ctrl-room:add-mixes', on);
  });
  const pick = (list, forceSong = null) => {
    const files = Array.from(list || []).filter((f) => f.size > 0 && /\.(wav|aiff?|mp3|m4a|flac)$/i.test(f.name))
      .sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
    if (!files.length) return;
    const batch = files.map((file, i) => {
      const parsed = parseMixName(file.name, { artist: p.artist, project: p.title });
      const song = forceSong ? p.songs.find((x) => x.id === forceSong) : matchSong(p.songs, parsed.title);
      return { id: `${Date.now()}-${i}-${Math.random()}`, file, title: parsed.title || file.name.replace(/\.[^.]+$/, ''), label: parsed.label, songId: song?.id || null, state: 'waiting', status: 'Waiting…' };
    });
    setRows((rs) => [...rs, ...batch]);
    chain.current = chain.current.then(() => run(batch)); // one after another, as you keep adding
  };
  const input_el = <input ref={input} id="addmix-file" className="vh" type="file" multiple accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />;
  if (!rows.length) return input_el; // nothing yet: just the hidden picker (opened from the + menu)
  return (
    <div className={`panel addmixes ${hot ? 'hot' : ''}`} style={{ marginBottom: 24 }}
      onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setHot(false); pick(e.dataTransfer?.files); }}>
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{busy ? 'Adding mixes…' : 'Mixes added'}</h3>
        <span className="row-actions">
          <button className="btn small" onClick={() => input.current?.click()}>+ Add more</button>
          {!busy && <button className="btn small quiet" onClick={() => { setRows([]); setDone([]); }}>Done</button>}
        </span>
      </div>
      <ul className="act addlist">
        {rows.map((r) => (
          <li key={r.id} className={`addrow ${r.state}`}>
            <span className="addname">{r.file.name}</span>
            <span className="addstat">{r.state === 'done' ? `✓ ${r.status}` : r.status}</span>
          </li>
        ))}
      </ul>
      {!busy && done.length > 0 && (
        <div className="row-actions" style={{ alignItems: 'center' }}>
          <span className="muted small">In the project and on the timeline. Rename a song from its ⋯ menu.</span>
          <NotifyClient deliveries={done} />
        </div>
      )}
      {input_el}
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
  const parts = []; // the song count already shows under the title
  if (total) parts.push(`${mmss(total)} total`);
  return (
    <div className="tstats">
      <span className="mono">{parts.join('  ·  ')}</span>
      {eng && busy && <span className="muted small">{busy}</span>}
    </div>
  );
}

/** Engineer extras, tucked away: loudness spread, peaks, formats, tempo and keys across the project. */
function NerdStuff({ songs }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('ctrl-room:nerd') === '1'; } catch { return false; } });
  const toggle = () => { setOpen(!open); try { localStorage.setItem('ctrl-room:nerd', open ? '0' : '1'); } catch {} };
  const rows = songs.map((s) => ({ s, v: currentMix(s, s.versions || []) })).filter((x) => x.v);
  if (!rows.length) return null;
  const lu = rows.filter((x) => x.v.lufs != null);
  const pk = rows.filter((x) => x.v.peak_db != null);
  const loud = lu.length ? lu.reduce((a, b) => (b.v.lufs > a.v.lufs ? b : a)) : null;
  const quiet = lu.length ? lu.reduce((a, b) => (b.v.lufs < a.v.lufs ? b : a)) : null;
  const avg = lu.length ? 10 * Math.log10(lu.reduce((n, x) => n + Math.pow(10, x.v.lufs / 10), 0) / lu.length) : null;
  const hot = pk.filter((x) => x.v.peak_db > -0.1);
  const count = (arr) => Object.entries(arr.reduce((m, k) => (k ? { ...m, [k]: (m[k] || 0) + 1 } : m), {})).sort((a, b) => b[1] - a[1]);
  const formats = count(rows.map((x) => [x.v.file_format, x.v.bit_depth ? `${Math.abs(x.v.bit_depth)}-bit${x.v.bit_depth < 0 ? ' float' : ''}` : '', x.v.sample_rate ? `${(x.v.sample_rate / 1000).toFixed(x.v.sample_rate % 1000 ? 1 : 0)} kHz` : ''].filter(Boolean).join(' · ')));
  const bpms = songs.map((s) => Number(s.bpm)).filter(Boolean);
  const keys = count(songs.map((s) => s.musical_key));
  const size = rows.reduce((n, x) => n + (x.v.file_size || 0), 0);
  const Stat = ({ k, v, sub }) => <div className="nerdstat"><span>{k}</span><b className="mono">{v}</b>{sub && <small>{sub}</small>}</div>;
  return (
    <div className="nerd">
      <button className={`nerdbtn ${open ? 'on' : ''}`} onClick={toggle} aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18V9M9 18V5M14 18v-6M19 18V8" /></svg>Nerd stuff<span className="vp-chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="nerdpanel">
          <div className="nerdgrid">
            {lu.length > 0 && <Stat k="Loudness range" v={lu.length > 1 ? `${quiet.v.lufs.toFixed(1)} to ${loud.v.lufs.toFixed(1)}` : lu[0].v.lufs.toFixed(1)} sub="LUFS integrated" />}
            {lu.length > 1 && <Stat k="Spread" v={`${(loud.v.lufs - quiet.v.lufs).toFixed(1)} LU`} sub={loud.v.lufs - quiet.v.lufs > 2 ? 'Songs may feel uneven back to back' : 'Nice and even'} />}
            {avg != null && <Stat k="Project average" v={`${avg.toFixed(1)} LUFS`} />}
            {loud && lu.length > 1 && <Stat k="Loudest" v={loud.s.title} sub={`${loud.v.lufs.toFixed(1)} LUFS · ${loud.v.label}`} />}
            {quiet && lu.length > 1 && <Stat k="Quietest" v={quiet.s.title} sub={`${quiet.v.lufs.toFixed(1)} LUFS · ${quiet.v.label}`} />}
            {pk.length > 0 && <Stat k="Highest peak" v={`${Math.max(...pk.map((x) => x.v.peak_db)).toFixed(1)} dBFS`} sub={hot.length ? `${hot.length} at or near 0 dBFS: ${hot.map((x) => x.s.title).join(', ')}` : 'Nothing clipping'} />}
            {formats.length > 0 && <Stat k="Formats" v={formats.length === 1 ? formats[0][0] : `${formats.length} kinds`} sub={formats.length > 1 ? formats.map(([f, n]) => `${n}× ${f}`).join(' · ') : 'Every song matches'} />}
            {bpms.length > 0 && <Stat k="Tempo" v={bpms.length > 1 ? `${Math.min(...bpms)}–${Math.max(...bpms)} BPM` : `${bpms[0]} BPM`} />}
            {keys.length > 0 && <Stat k="Keys" v={keys.length === 1 ? keys[0][0] : `${keys.length} keys`} sub={keys.length > 1 ? keys.map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(' · ') : ''} />}
            {size > 0 && <Stat k="Current mixes" v={fmtBytes(size)} sub={`${rows.length} file${rows.length === 1 ? '' : 's'}`} />}
          </div>
          {!lu.length && <p className="muted small" style={{ margin: 0 }}>Loudness shows up once the mixes have been measured (it happens on its own in the background).</p>}
        </div>
      )}
    </div>
  );
}

const ALL_COLS = [
  { k: 'ver', label: 'Version', w: '72px' },
  { k: 'len', label: 'Length', w: '60px' },
  { k: 'fmt', label: 'Format', w: '96px' },
  { k: 'bpm', label: 'BPM', w: '48px' },
  { k: 'key', label: 'Key', w: '76px' },
  { k: 'lufs', label: 'LUFS', w: '58px', eng: true, tip: 'Integrated loudness (EBU R128)' },
  { k: 'peak', label: 'Peak', w: '56px', eng: true, tip: 'Sample peak, dBFS' },
];
const DEFAULT_COLS = ['ver', 'len', 'fmt', 'bpm', 'key'];

/** "Columns" menu: tick what shows in the tracklist. Saved per person. */
function ColumnPicker({ cols, shown, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  const flip = (k) => onChange(shown.includes(k) ? shown.filter((x) => x !== k) : cols.map((c) => c.k).filter((x) => x === k || shown.includes(x)));
  return (
    <div className="colpick" ref={box}>
      <button className={`colbtn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>Columns
      </button>
      {open && (
        <div className="colmenu" role="menu">
          <p>Show in the tracklist</p>
          {cols.map((c) => (
            <label key={c.k} className="colitem"><input type="checkbox" checked={shown.includes(c.k)} onChange={() => flip(c.k)} />{c.label}</label>
          ))}
          <button className="link small" onClick={() => onChange(DEFAULT_COLS)}>Reset to default</button>
          <small>Saved to your account, just for you.</small>
        </div>
      )}
    </div>
  );
}

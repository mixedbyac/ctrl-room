'use client';
import { useLive } from '@/lib/live';
import { PORTAL_URL } from '@/lib/site';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import SendOut from '@/components/SendOut';
import { fmtBytes, ago, todayISO } from '@/lib/format';
import { macCanDownload, macDownload, isMacApp } from '@/lib/native';
import { zipFromUrls } from '@/lib/streamzip';

export default function Inbox() {
  const { eng, session } = useApp();
  const [tool, setTool] = useState(null);
  const [rows, setRows] = useState(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('inbox');
  const [msg, setMsg] = useState('');
  const [dl, setDl] = useState({}); // uploadId -> 'label'
  const [tickets, setTickets] = useState({}); // older Mac app: download links made ahead, so a click opens the browser right away
  useEffect(() => {
    if (!isMacApp() || macCanDownload() || !rows?.length) return;
    api('/api/portal/files', { ticketsFor: rows.map((u) => u.id) }).then((r) => setTickets(r.tickets || {})).catch(() => {});
  }, [rows?.length]); // eslint-disable-line
  const load = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.from('uploads').select('*, projects(id,title,seed,artist,cover_path)').order('created_at', { ascending: false }).limit(100);
    // downloaded sends file themselves into Archived (also ones downloaded before this existed)
    // (once: after that, a send you move back to the inbox stays there)
    let done = false; try { done = localStorage.getItem('ctrl-inbox-autoarchived') === '1'; } catch {}
    const stale = done ? [] : (data || []).filter((u) => u.downloaded_at && u.archived === false);
    try { localStorage.setItem('ctrl-inbox-autoarchived', '1'); } catch {}
    if (stale.length) { const { error } = await sb.from('uploads').update({ archived: true }).in('id', stale.map((u) => u.id)); if (!error) stale.forEach((u) => { u.archived = true; }); }
    setRows(data || []);
    // you've seen these: the "New files received" note on their projects goes away
    try {
      const seen = new Set(JSON.parse(localStorage.getItem('ctrl-files-seen') || '[]'));
      (data || []).forEach((u) => (u.songs || []).forEach((s) => s.songId && seen.add(s.songId)));
      localStorage.setItem('ctrl-files-seen', JSON.stringify([...seen].slice(-2000)));
      const ups = new Set(JSON.parse(localStorage.getItem('ctrl-uploads-seen') || '[]'));
      (data || []).forEach((u) => ups.add(u.id));
      localStorage.setItem('ctrl-uploads-seen', JSON.stringify([...ups].slice(-500)));
      window.dispatchEvent(new Event('ctrl-room:bell-refresh'));
    } catch {}
  }, []);
  useEffect(() => { if (eng) load(); }, [eng, load]);
  useLive(() => { if (eng) load(); });

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Portal' }]} /><section className="page"><div className="empty-state"><strong>This page is for your engineer</strong><Link className="btn primary" href="/portal">Send files instead</Link></div></section></>;

  const markDownloaded = async (u) => {
    const sb = supabase();
    await sb.from('uploads').update({ downloaded_at: new Date().toISOString(), archived: true }).eq('id', u.id); // downloaded = done: straight to Archived
    for (const s of u.songs || []) {
      if (!s.files) continue;
      await sb.from('songs').update({ downloaded_at: todayISO() }).eq('id', s.songId);
      let texted = false;
      try { texted = (await api('/api/sms', { songId: s.songId, body: 'Downloaded your files. Everything looks good.' })).sent; } catch {}
      await sb.from('updates').insert({ song_id: s.songId, body: 'Downloaded your files. Everything looks good.', texted });
    }
    load();
  };
  // Download a whole send to this computer. Mac app: one folder in Downloads. Browser: file by file.
  const download = async (u) => {
    setMsg('');
    const say = (t) => setDl((x) => ({ ...x, [u.id]: t }));
    say('Getting files…');
    try {
      // an older Mac app can't save a zip itself: the zip gets made in your regular browser instead (it opens there and downloads)
      if (isMacApp() && !macCanDownload()) {
        const ticket = tickets[u.id] || (await api('/api/portal/files', { ticketFor: u.id })).ticket;
        window.open(`https://www.ctrl-room.app/get?k=${encodeURIComponent(ticket)}`, '_blank');
        say('');
        if (!u.downloaded_at) await markDownloaded(u);
        return;
      }
      const r = await api('/api/portal/files', { uploadId: u.id });
      const total = r.files.length;
      if (macCanDownload()) {
        const res = await macDownload(r, (ev) => say(ev.zipping ? 'Zipping…' : `Downloading ${ev.done}/${ev.total}`));
        if (res.error) setMsg(res.error);
      } else {
        // one zip, built here as the files arrive, saved as a single download
        const blob = await zipFromUrls(r.files, (ev) => say(`Zipping ${ev.done}/${ev.total}`));
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = href; a.download = `${r.folder}.zip`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 120000);
      }
      say('');
      if (!u.downloaded_at) await markDownloaded(u); // downloaded = done (and archived)
      else setMsg(`Downloaded ${total} file${total > 1 ? 's' : ''}.`);
    } catch (e) {
      say('');
      // couldn't fetch the links: open the send's folder on dropbox.com instead (Download folder is up top there)
      const folder = (u.songs || []).find((s) => s.files && s.folder)?.folder;
      setMsg(folder ? `${e.message} Opening the folder in Dropbox instead.` : e.message);
      if (folder) window.open(`https://www.dropbox.com/home${folder.split('/').map(encodeURIComponent).join('/')}`, '_blank');
    }
  };
  const archive = async (u, on) => {
    setMsg('');
    const { error } = await supabase().from('uploads').update({ archived: on }).eq('id', u.id);
    if (error) return setMsg(/archived/.test(error.message) ? 'Archiving needs one line in Supabase (SQL Editor › New snippet › Run):  alter table uploads add column if not exists archived boolean not null default false;' : error.message);
    setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, archived: on } : r)));
  };
  const shown = (rows || []).filter((u) => (view === 'archived' ? u.archived : !u.archived));
  const archivedCount = (rows || []).filter((u) => u.archived).length;
  const portalLink = PORTAL_URL;

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Portal' }]} />
      <section className="page portal">
        <div>
          <h1 className="up">Portal inbox</h1>
          <p className="lede">Everything clients send through your Portal, filed into your Dropbox in a folder for each artist.</p>
          <div className="share-link" style={{ marginTop: 14 }}><code>{portalLink}</code>
            <button className={`btn small copybtn ${copied ? 'done' : ''}`} onClick={async () => { try { await navigator.clipboard.writeText(portalLink); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch {} }}>{copied ? '✓ Copied' : 'Copy Portal link'}</button>
            <Link className="btn small" href="/dropbox">Dropbox settings</Link></div>
          <div className="ptools" role="tablist" aria-label="Portal tools">
            <button role="tab" aria-selected={tool === 'link'} onClick={() => setTool(tool === 'link' ? null : 'link')}>⇪ Link for one project</button>
            <button role="tab" aria-selected={tool === 'send'} onClick={() => setTool(tool === 'send' ? null : 'send')}>➚ Send files to an artist</button>
          </div>
          {tool === 'link' && <ProjectLink />}
          {tool === 'send' && <SendOut />}
        </div>
        <div className="inbox">
          <div className="itabs" role="tablist">
            <button role="tab" aria-selected={view === 'inbox'} onClick={() => setView('inbox')}>Inbox<span>{(rows || []).length - archivedCount}</span></button>
            <button role="tab" aria-selected={view === 'archived'} onClick={() => setView('archived')}>Archived<span>{archivedCount}</span></button>
          </div>
          {msg && <p className="toast-inline">{msg}</p>}
          {rows === null ? <p className="muted">Loading…</p> : shown.length ? shown.map((u) => (
            <article key={u.id} className="ucard">
              <Cover seed={u.projects?.seed} path={u.projects?.cover_path} size={120} />
              <div style={{ minWidth: 0 }}>
                <h3 className="ttl">{u.projects?.title || 'Project'}{!u.downloaded_at && <span className="new">NEW</span>}</h3>
                <div className="m">{u.name} · {u.artist}{u.phone ? ` · ${u.phone}` : ''} · {u.email} · {ago(u.created_at)}</div>
                {u.message && <p className="msgq">“{u.message}”</p>}
                <ul className="songsent">
                  {(u.songs || []).map((s) => (
                    <li key={s.songId}><b><Link href={`/s/${s.songId}`}>{s.title}</Link></b><span className="m">{s.files ? `${s.files} files · ${fmtBytes(s.bytes)}` : 'No files yet'}</span>
                      {s.files && s.folder ? <span className="path">Dropbox › {s.folder.replace(/^\//, '').replace(/\//g, ' / ')}</span> : null}</li>
                  ))}
                </ul>
              </div>
              <div className="acts">
                {(u.songs || []).some((s) => s.files) && <button className={`btn small ${u.downloaded_at ? '' : 'primary'}`} onClick={() => download(u)} disabled={!!dl[u.id]}>
                  {dl[u.id] || <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Download</>}</button>}
                {u.downloaded_at ? <span className="m">Downloaded {ago(u.downloaded_at)}</span> : <button className="btn small quiet" onClick={() => markDownloaded(u)}>Mark downloaded</button>}
                {u.projects && <Link className="btn small" href={`/p/${u.projects.id}`}>Open project</Link>}
                <button className="btn small quiet" onClick={() => archive(u, !u.archived)}>{u.archived ? 'Move to inbox' : 'Archive'}</button>
              </div>
            </article>
          )) : view === 'archived' ? <div className="empty-state"><strong>Nothing archived</strong>Archive a send once you’ve dealt with it to keep your inbox clear.</div>
            : <div className="empty-state"><strong>{rows.length ? 'All clear' : 'Nothing yet'}</strong>{rows.length ? 'Everything is archived. New sends show up here.' : 'Send clients your Portal link. Their files land in your Dropbox and show up here.'}</div>}
        </div>
      </section>
    </>
  );
}

/** A sendfileshere link for one project: whatever's sent with it drops straight into that project. */
function ProjectLink() {
  const { projects = [] } = useApp() || {};
  const [pid, setPid] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const get = (id, reset = false) => { setUrl(''); setMsg(''); if (!id) return; api('/api/portal/linkfor', { projectId: id, reset }).then((r) => setUrl(r.url)).catch((e) => setMsg(e.message)); };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setMsg('Select the link and copy it.'); } };
  return (
    <div className="panel sendout" style={{ marginTop: 14 }}>
      <h3>Link for one project</h3>
      <p className="muted small" style={{ margin: 0 }}>Files sent with this link go straight into that project: no account and no picking a project. Same song names add to those songs; new names become new songs.</p>
      <div className="fld"><label htmlFor="pl-p">Project</label>
        <select id="pl-p" value={pid} onChange={(e) => { setPid(e.target.value); get(e.target.value); }}>
          <option value="">Pick a project…</option>
          {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.artist ? `${p.artist} · ` : ''}{p.title}</option>)}
        </select></div>
      {pid && <div className="share-link"><code>{url || 'Making the link…'}</code>
        <button className={`btn small copybtn ${copied ? 'done' : ''}`} onClick={copy} disabled={!url}>{copied ? '✓ Copied' : 'Copy link'}</button>
        <button className="btn small quiet" disabled={!url} onClick={() => { if (window.confirm('Make a new link? The old one stops working.')) get(pid, true); }}>Reset</button></div>}
      {msg && <p className="toast-inline">{msg}</p>}
    </div>
  );
}

'use client';
import { PORTAL_URL } from '@/lib/site';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import SendOut from '@/components/SendOut';
import { fmtBytes, ago, todayISO } from '@/lib/format';

export default function Inbox() {
  const { eng, session } = useApp();
  const [tool, setTool] = useState(null);
  const [rows, setRows] = useState(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('inbox');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase().from('uploads').select('*, projects(id,title,seed,artist,cover_path)').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  }, []);
  useEffect(() => { if (eng) load(); }, [eng, load]);

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Portal' }]} /><section className="page"><div className="empty-state"><strong>This page is for your engineer</strong><Link className="btn primary" href="/portal">Send files instead</Link></div></section></>;

  const markDownloaded = async (u) => {
    const sb = supabase();
    await sb.from('uploads').update({ downloaded_at: new Date().toISOString() }).eq('id', u.id);
    for (const s of u.songs || []) {
      if (!s.files) continue;
      await sb.from('songs').update({ downloaded_at: todayISO() }).eq('id', s.songId);
      let texted = false;
      try { texted = (await api('/api/sms', { songId: s.songId, body: 'Downloaded your files. Everything looks good.' })).sent; } catch {}
      await sb.from('updates').insert({ song_id: s.songId, body: 'Downloaded your files. Everything looks good.', texted });
    }
    load();
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
                {u.downloaded_at ? <span className="m">Downloaded {ago(u.downloaded_at)}</span> : <button className="btn small primary" onClick={() => markDownloaded(u)}>Mark downloaded</button>}
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

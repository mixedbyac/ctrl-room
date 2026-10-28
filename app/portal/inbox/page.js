'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmtBytes, ago, todayISO } from '@/lib/format';

export default function Inbox() {
  const { eng, session } = useApp();
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase().from('uploads').select('*, projects(id,title,seed,artist)').order('created_at', { ascending: false }).limit(100);
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
  const portalLink = process.env.NEXT_PUBLIC_PORTAL_URL || (typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal');

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Portal' }]} />
      <section className="page portal">
        <div>
          <h1 className="up">Portal inbox</h1>
          <p className="lede">Everything clients send through your Portal, filed into your Dropbox by artist, project and song.</p>
          <div className="share-link" style={{ marginTop: 14 }}><code>{portalLink}</code>
            <button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(portalLink); } catch {} }}>Copy Portal link</button>
            <Link className="btn small" href="/dropbox">Dropbox settings</Link></div>
        </div>
        <div className="inbox">
          {rows === null ? <p className="muted">Loading…</p> : rows.length ? rows.map((u) => (
            <article key={u.id} className="ucard">
              <Cover seed={u.projects?.seed} size={120} />
              <div style={{ minWidth: 0 }}>
                <h3 className="up">{u.projects?.title || 'Project'}{!u.downloaded_at && <span className="new">NEW</span>}</h3>
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
              </div>
            </article>
          )) : <div className="empty-state"><strong>Nothing yet</strong>Send clients your Portal link. Their files land in your Dropbox and show up here.</div>}
        </div>
      </section>
    </>
  );
}

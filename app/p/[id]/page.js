'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { fmtDate, shortDate, statusText } from '@/lib/format';

export default function ProjectPage() {
  const { id } = useParams();
  const { eng, reloadProjects } = useApp();
  const [p, setP] = useState(undefined);
  const [panel, setPanel] = useState(null); // 'share' | 'edit' | 'add'

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
  const crumbs = eng ? [{ label: 'Home', href: '/' }, { label: p.title }] : [{ label: 'Projects', href: '/' }, { label: p.title }];

  return (
    <>
      <TopBar crumbs={crumbs} />
      <section className="page">
        <div className="phero">
          <div className="sleevewrap">
            <div className="record"><div className="vinyl"><Cover as="div" seed={p.seed} size={240} className="lbl" /></div></div>
            <div className="sleeve"><Cover seed={p.seed} size={600} alt={`${p.title} cover`} /></div>
          </div>
          <div className="pinfo">
            <h1 className="up">{p.title}</h1>
            <p className="psub">{p.artist} · {p.type} · {p.songs.length} song{p.songs.length === 1 ? '' : 's'} · {approved} approved{p.release ? ` · out ${fmtDate(p.release)}` : ''}</p>
            <div className="prow">
              {firstPlayable && <Link className="bigplay" href={`/s/${firstPlayable.id}`} aria-label="Open the first mix"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg></Link>}
              {!eng && <span className="chipnote">{ready ? `${ready} mix${ready > 1 ? 'es' : ''} waiting on you` : "You're all caught up"}</span>}
              {eng && <>
                <button className="gear" onClick={() => setPanel(panel === 'share' ? null : 'share')}>Share with client</button>
                <button className="gear" onClick={() => setPanel(panel === 'add' ? null : 'add')}>+ Add song</button>
                <button className="gear" onClick={() => setPanel(panel === 'edit' ? null : 'edit')}>Edit details</button>
              </>}
            </div>
          </div>
        </div>

        {eng && panel === 'share' && <SharePanel p={p} onSaved={load} />}
        {eng && panel === 'add' && <AddSong p={p} onSaved={() => { load(); setPanel(null); }} />}
        {eng && panel === 'edit' && <EditProject p={p} onSaved={() => { load(); reloadProjects(); setPanel(null); }} />}

        <div className="rows">
          {p.songs.length ? p.songs.map((s, i) => {
            const vs = [...(s.versions || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
            const last = vs.at(-1);
            const sub = vs.length ? statusText(s, vs) : s.eta ? `First mix ${fmtDate(s.eta)}` : statusText(s, vs);
            return (
              <Link key={s.id} href={`/s/${s.id}`} className={`row ${vs.length ? '' : 'nomix'}`} style={{ '--i': i }}>
                <span className="rplay"><span className="num">{i + 1}</span><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg></span>
                <span className="ropen"><span className="t up">{s.title}</span><span className="rsub"><span className={`dot ${s.status}`}>{sub}</span>{last ? <span>· {shortDate(last.created_at)}</span> : null}</span></span>
                <span className="rmeta">{last ? <span className="vtag">{last.label}</span> : null}<span className="chev" aria-hidden="true">›</span></span>
              </Link>
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

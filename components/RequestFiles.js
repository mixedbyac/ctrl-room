'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase';

/** A project's file-request link: copy it, or email it to the artist's team. Files sent with it land in this project. */
export default function RequestFiles({ project }) {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const get = (reset = false) => { setUrl(''); setMsg(''); api('/api/portal/linkfor', { projectId: project.id, reset }).then((r) => setUrl(r.url)).catch((e) => setMsg(e.message)); };
  useEffect(() => { get(); }, [project.id]); // eslint-disable-line
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setMsg('Select the link and copy it.'); } };
  const email = async () => {
    setBusy(true); setMsg('');
    try { const r = await api('/api/portal/linkfor', { projectId: project.id, email: true, message: note }); setMsg(r.emailed ? `Emailed ${r.count} ${r.count === 1 ? 'person' : 'people'} on ${project.artist || 'the'} team.` : `Didn’t email: ${r.reason || 'no one to email yet'}. Copy the link and text it instead.`); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="postupd">
      <h3>Request files</h3>
      <p className="muted small" style={{ margin: 0 }}>Anyone with this link can drop files straight into <b>{project.title}</b>: no account needed. Song names that match go into those songs.</p>
      <div className="share-link"><code>{url || 'Making the link…'}</code>
        <button className={`btn small copybtn ${copied ? 'done' : ''}`} onClick={copy} disabled={!url}>{copied ? '✓ Copied' : 'Copy link'}</button></div>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, like “Send the stems and the session BPM when you can.”" aria-label="Note" />
      <div className="purow">
        <button className="btn small quiet" disabled={!url} onClick={() => { if (window.confirm('Make a new link? The old one stops working.')) get(true); }}>New link</button>
        <button className="btn primary small" onClick={email} disabled={!url || busy}>{busy ? 'Sending…' : 'Email it to the artist’s team'}</button>
      </div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

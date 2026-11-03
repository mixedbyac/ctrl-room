'use client';
import { useRef, useState } from 'react';
import { supabase, api } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';

const fmt = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/** Engineer → artist: pick files, they upload, the artist's team gets an email with a download button for each. */
export default function SendOut({ projectId = null, title = '' }) {
  const { projects = [] } = useApp() || {};
  const [pid, setPid] = useState(projectId || '');
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [hot, setHot] = useState(false);
  const input = useRef(null);
  const add = (list) => setFiles((fs) => [...fs, ...Array.from(list || []).filter((f) => f.size > 0)].slice(0, 50));
  const total = files.reduce((n, f) => n + f.size, 0);
  const send = async () => {
    if (!pid) return setMsg('Pick the project to send to.');
    if (!files.length) return setMsg('Add at least one file.');
    setMsg(''); setBusy('Getting ready…');
    try {
      const { slots } = await api('/api/sendout', { step: 'start', projectId: pid, files: files.map((f) => ({ name: f.name, size: f.size })) });
      for (let i = 0; i < slots.length; i++) {
        setBusy(`Uploading ${i + 1} of ${slots.length}…`);
        const { error } = await supabase().storage.from('mixes').uploadToSignedUrl(slots[i].path, slots[i].token, files[i], { contentType: files[i].type || 'application/octet-stream' });
        if (error) throw new Error(`${files[i].name}: ${error.message}`);
      }
      setBusy('Emailing the artist…');
      const r = await api('/api/sendout', { step: 'done', projectId: pid, message, files: slots.map((s, i) => ({ path: s.path, name: files[i].name, size: files[i].size })) });
      setMsg(`Sent ${r.files} file${r.files > 1 ? 's' : ''} to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}. You’ll get a confirmation too.`);
      setFiles([]); setMessage('');
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  return (
    <div className={`panel sendout ${hot ? 'hot' : ''}`} style={{ marginBottom: 24 }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHot(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHot(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setHot(false); add(e.dataTransfer?.files); }}>
      <h3>Send files to the artist</h3>
      <p className="muted small" style={{ margin: 0 }}>Stems, instrumentals, a session, anything. The artist’s team gets an email with a download button for each file (links last 14 days).</p>
      {!projectId && (
        <div className="fld"><label htmlFor="so-p">Project</label>
          <select id="so-p" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Pick a project…</option>
            {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.artist ? `${p.artist} · ` : ''}{p.title}</option>)}
          </select></div>
      )}
      <button type="button" className="sendoutdrop" onClick={() => input.current?.click()} disabled={!!busy}>
        {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} · ${fmt(total)} · tap to add more` : 'Drop files here, or tap to pick'}
      </button>
      {files.length > 0 && <ul className="sendoutlist">{files.map((f, i) => <li key={i}><span>{f.name}</span><small>{fmt(f.size)}</small><button type="button" className="link small" onClick={() => setFiles((fs) => fs.filter((_, k) => k !== i))} disabled={!!busy}>Remove</button></li>)}</ul>}
      <div className="fld"><label htmlFor="so-m">Message <span className="opt">optional</span></label><textarea id="so-m" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={title ? `Here are the stems for ${title}…` : 'Here are your stems…'} /></div>
      <div className="row-actions"><button className="btn small primary" onClick={send} disabled={!!busy || !files.length}>{busy || 'Send to artist'}</button></div>
      {msg && <p className="toast-inline">{msg}</p>}
      <input ref={input} type="file" multiple className="vh" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { api } from '@/lib/supabase';

const QUICK = ['Downloaded your files. Everything looks good.', 'Started mixing.', 'Mix coming tonight.', 'Working on your notes now.', 'Revisions are up, have a listen.', 'Mastering now.'];

/** Post an update to the artist's team: one song, or any songs in the project. Shows on each song and (optionally) emails them once. */
export default function PostUpdate({ project, songs, preselect, onDone }) {
  const [body, setBody] = useState('');
  const [pick, setPick] = useState(() => new Set(preselect?.length ? preselect : songs.map((s) => s.id)));
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const single = songs.length === 1 || (preselect?.length === 1 && pick.size === 1);
  const toggle = (id) => setPick((x) => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const post = async () => {
    if (!body.trim() || !pick.size) return;
    setBusy(true); setMsg('');
    try {
      const r = await api('/api/update', { projectId: project.id, songIds: [...pick], body: body.trim(), email, total: songs.length });
      setMsg(`Posted${r.songs > 1 ? ` to ${r.songs} songs` : ''}${email ? (r.emailed ? `, emailed ${r.count || 'the team'}${r.count ? ` ${r.count === 1 ? 'person' : 'people'}` : ''}.` : `. The email didn’t go out: ${r.reason || 'no one to email yet'}.`) : '.'}`);
      setBody('');
      onDone?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="postupd">
      <h3>Post an update</h3>
      <p className="muted small" style={{ margin: 0 }}>{single ? 'Shows on the song’s timeline.' : 'Shows on each song you pick.'} {email ? 'The artist’s team gets one email.' : ''}</p>
      <div className="puquick">{QUICK.map((q) => <button key={q} type="button" onClick={() => setBody(q)}>{q}</button>)}</div>
      <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Like “Vocals are tuned, starting the mix tonight.”" aria-label="Update" autoFocus />
      {songs.length > 1 && (
        <div className="pusongs">
          <label className="puall"><input type="checkbox" checked={pick.size === songs.length} onChange={(e) => setPick(e.target.checked ? new Set(songs.map((s) => s.id)) : new Set())} /> All songs</label>
          {songs.map((s) => <label key={s.id}><input type="checkbox" checked={pick.has(s.id)} onChange={() => toggle(s.id)} /> {s.title}</label>)}
        </div>
      )}
      <div className="purow">
        <label className="smsopt"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email the artist’s team</label>
        <button className="btn primary small" onClick={post} disabled={busy || !body.trim() || !pick.size}>{busy ? 'Posting…' : 'Post update'}</button>
      </div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

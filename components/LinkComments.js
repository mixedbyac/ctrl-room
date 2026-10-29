'use client';
import { useCallback, useEffect, useState } from 'react';
import CommentList from '@/components/Comments';
import { fmt } from '@/lib/format';

const guestId = () => {
  try { let g = localStorage.getItem('ctrl-room:guest'); if (!g) { g = (crypto.randomUUID?.() || String(Math.random()).slice(2)); localStorage.setItem('ctrl-room:guest', g); } return g; } catch { return 'anon'; }
};

/** Comments on a share link (only shows when the engineer turned them on for the project). */
export default function LinkComments({ token, songId, versionId, time, seek }) {
  const [state, setState] = useState(null);
  const [name, setName] = useState(() => { try { return localStorage.getItem('ctrl-room:guest-name') || ''; } catch { return ''; } });
  const [body, setBody] = useState('');
  const [atTime, setAtTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = `guest:${guestId()}`;
  const load = useCallback(() => {
    if (!songId || !versionId) return;
    fetch(`/api/share/notes?t=${encodeURIComponent(token)}&songId=${songId}&versionId=${versionId}`, { cache: 'no-store' }).then((r) => r.json()).then(setState).catch(() => setState({ enabled: false }));
  }, [token, songId, versionId]);
  useEffect(() => { load(); }, [load]);
  // tell the page whether comments are on (the phone mini player offers a quick comment), and reload when it posts one
  useEffect(() => { window.dispatchEvent(new CustomEvent('ctrl-room:link-comments', { detail: { enabled: !!state?.enabled } })); }, [state?.enabled]);
  useEffect(() => { const r = () => load(); window.addEventListener('ctrl-room:link-notes', r); return () => window.removeEventListener('ctrl-room:link-notes', r); }, [load]);
  if (!state?.enabled) return null;
  const call = async (payload) => {
    const r = await fetch('/api/share/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, songId, versionId, guestId: guestId(), name, ...payload }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Couldn’t post that.'); return false; }
    setErr(''); load(); return true;
  };
  const post = async () => {
    if (!body.trim()) return;
    if (!name.trim()) return setErr('Add your name so the artist knows who said it.');
    try { localStorage.setItem('ctrl-room:guest-name', name.trim()); } catch {}
    setBusy(true);
    if (await call({ action: 'post', body, at: atTime ? time : null })) setBody('');
    setBusy(false);
  };
  const actions = {
    reply: (parent, text) => (name.trim() ? call({ action: 'post', body: text, parentId: parent.id }) : setErr('Add your name first.')),
    react: (n, emoji, on) => call({ action: on ? 'react' : 'unreact', noteId: n.id, emoji }),
  };
  const nums = {};
  state.notes.filter((n) => n.t != null && !n.parent_id).sort((a, b) => a.t - b.t).forEach((n, i) => { nums[n.id] = i + 1; });
  return (
    <section className="lcomments">
      <h2 className="up">Comments</h2>
      <div className="composer">
        <input className="lname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={40} />
        <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something about this mix…" aria-label="Comment"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }} />
        <div className="row2">
          <span className="nmode" role="group" aria-label="Comment type">
            <button aria-pressed={atTime} data-mode="time" onClick={() => setAtTime(true)}>At <span className="mono">{fmt(time)}</span></button>
            <button aria-pressed={!atTime} data-mode="general" onClick={() => setAtTime(false)}>General</button>
          </span>
          <button className="post" disabled={busy || !body.trim()} onClick={post}>Post</button>
        </div>
      </div>
      {err && <p className="ferr">{err}</p>}
      {!state.notes?.length && <p className="lcempty">No comments yet. Tap the comment button in the player to leave one at any moment.</p>}
      <CommentList notes={[...state.notes].sort((a, b) => (a.t ?? -1) - (b.t ?? -1))} reactions={state.reactions} me={me} numbers={nums}
        nameOf={(n) => n.author_name || 'Guest'} canResolve={false} canDelete={() => false} actions={actions} seek={(t) => seek(t)} />
    </section>
  );
}

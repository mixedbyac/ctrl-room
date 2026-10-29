'use client';
import { useEffect, useRef, useState } from 'react';
import { mmss } from '@/lib/format';

const parseTime = (s) => {
  const m = String(s || '').trim().match(/^(?:(\d+):)?(\d{1,2})(?:\.\d+)?$/);
  if (!m) return null;
  return (Number(m[1] || 0) * 60) + Number(m[2]);
};

/**
 * The note box used in the players: a timed note (with a time you can nudge or type) or a general note.
 * onPost(body, at) where at is seconds or null for a general note.
 */
export default function NoteComposer({ now, start, duration = 0, label = '', nameField = null, onPost, onCancel, onAt }) {
  const [mode, setMode] = useState('time');
  const [at, setAt] = useState(Math.max(0, Math.round(start ?? now ?? 0)));
  const [editing, setEditing] = useState(false);
  const [draftTime, setDraftTime] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const ta = useRef(null);
  useEffect(() => { onAt?.(mode === 'time' ? at : null); }, [at, mode]); // eslint-disable-line
  // focus after the player has finished moving, without the page jumping (smoother with the iPhone keyboard)
  useEffect(() => { const t = setTimeout(() => { try { ta.current?.focus({ preventScroll: true }); } catch { ta.current?.focus(); } }, 340); return () => clearTimeout(t); }, []);
  const clamp = (x) => Math.max(0, Math.min(duration || x, Math.round(x)));
  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await onPost(body.trim(), mode === 'time' ? at : null);
    setBusy(false);
    if (ok !== false) setBody('');
  };
  return (
    <div className="npcompose inline compact notecomposer" role="group" aria-label="Add a note">
      {nameField}
      <div className="ncmodes" role="group" aria-label="Note type">
        <button type="button" aria-pressed={mode === 'time'} onClick={() => setMode('time')}>At a moment</button>
        <button type="button" aria-pressed={mode === 'general'} onClick={() => setMode('general')}>General note</button>
      </div>
      {mode === 'time' && (
        <div className="nctime">
          <button type="button" className="ncnudge" onClick={() => setAt((x) => clamp(x - 5))} aria-label="5 seconds earlier">−5s</button>
          {editing ? (
            <input className="nctimein mono" autoFocus inputMode="numeric" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} aria-label="Time (minutes:seconds)"
              onBlur={() => { const t = parseTime(draftTime); if (t != null) setAt(clamp(t)); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }} />
          ) : (
            <button type="button" className="nctimebtn mono" onClick={() => { setDraftTime(mmss(at)); setEditing(true); }} title="Tap to type a time">{mmss(at)}</button>
          )}
          <button type="button" className="ncnudge" onClick={() => setAt((x) => clamp(x + 5))} aria-label="5 seconds later">+5s</button>
          <button type="button" className="ncnow" onClick={() => setAt(clamp(now || 0))}>Now</button>
        </div>
      )}
      <div className="nc-row">
        <textarea ref={ta} rows={1} enterKeyHint="send" value={body} placeholder={mode === 'time' ? `Note at ${mmss(at)}…` : 'A note about the whole mix…'} aria-label="Note"
          onChange={(e) => { setBody(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 110)}px`; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') onCancel?.(); }} />
        <button type="button" className="nc-send" disabled={!body.trim() || busy} onClick={send} aria-label="Post">{busy ? <span className="sbusy" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>}</button>
      </div>
      <div className="nc-sub"><span>{label}</span><button type="button" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

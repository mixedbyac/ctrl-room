'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/supabase';

const ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></svg>;

/** Share a song or project as a listen-only link. The engineer can switch sharing on/off and reset the link. */
export default function ShareButton({ kind, id, eng, title, open: openProp, onOpenChange, hideButton = false }) {
  const [openState, setOpenState] = useState(!!openProp);
  const open = openProp ?? openState;
  const setOpen = (o) => { setOpenState(o); onOpenChange?.(o); };
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const box = useRef(null);
  const what = kind === 'song' ? 'song' : 'project';

  const call = async (body) => {
    setBusy(true); setMsg('');
    try { setSt(await api('/api/share', { kind, id, ...body })); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (open && !st) call({}); }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);

  const copy = async () => { try { await navigator.clipboard.writeText(st.url); setMsg('Link copied.'); } catch { setMsg('Select the link and copy it.'); } };
  const native = async () => { try { await navigator.share({ title, url: st.url }); } catch {} };
  const canNative = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <span className="sharewrap" ref={box}>
      {!hideButton && <button className="gear" onClick={() => setOpen(!open)} aria-expanded={open}>{ICON}Share</button>}
      {open && (
        <div className="sharepop" role="dialog" aria-label={`Share this ${what}`}>
          <p className="shtitle">Share this {what}</p>
          {!st && !msg && <p className="muted small">Getting the link…</p>}
          {st?.allowed && <>
            <p className="muted small">Anyone with the link can listen{kind === 'project' ? ' to every song' : ''}. No account needed. They can’t see notes or other versions.</p>
            <div className="shlink"><input readOnly value={st.url} onFocus={(e) => e.target.select()} aria-label="Share link" /></div>
            <div className="row-actions">
              <button className="btn small primary" onClick={copy}>Copy link</button>
              {canNative && <button className="btn small" onClick={native}>Share…</button>}
            </div>
          </>}
          {st && !st.allowed && !eng && <p className="muted small">Sharing is turned off for this {st.projectSharing ? what : 'project'}.</p>}
          {eng && st && <div className="shopts">
            <label className="shrow">
              <span><b>Allow sharing</b><span className="muted small">{st.sharing ? 'Clients and anyone with the link can listen.' : 'Only people you’ve invited can listen.'}</span></span>
              <button className="switch" role="switch" aria-checked={st.sharing} disabled={busy} onClick={() => call({ action: 'set', on: !st.sharing })}><i /></button>
            </label>
            <label className="shrow">
              <span><b>Comments on the link</b><span className="muted small">{st.comments ? 'People with the link can comment and react. Your notes show on the link too.' : 'Off: notes stay private to you and the project team.'}</span></span>
              <button className="switch" role="switch" aria-checked={!!st.comments} disabled={busy} onClick={() => call({ action: 'comments', on: !st.comments })}><i /></button>
            </label>
            {kind === 'song' && !st.projectSharing && <p className="muted small">Sharing is off for the whole project, so this song can’t be shared either. Turn it on from the project page.</p>}
            {st.allowed && <button className="btn small quiet" disabled={busy} onClick={() => { if (confirm('Make a new link? The old one will stop working.')) call({ action: 'reset' }); }}>Reset link</button>}
          </div>}
          {msg && <p className="toast-inline">{msg}</p>}
        </div>
      )}
    </span>
  );
}

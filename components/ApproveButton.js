'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { pingPush } from '@/lib/pushclient';

const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

/**
 * The big, clear “Approve” button (player and share links). Asks once to be sure, then marks the mix final
 * and tells the engineer. On a share link, someone who isn't signed in is asked to sign in as the artist's team.
 * A small tip points it out the first time someone sees it.
 */
export default function ApproveButton({ songId, versionId, label, title, approved = false, signInHref = null, onDone, tipKey = 'cr_tip_approve' }) {
  const [ask, setAsk] = useState(null); // null | 'confirm' | 'signin'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(approved);
  const [tip, setTip] = useState(false);
  useEffect(() => { setDone(approved); }, [approved, versionId]);
  useEffect(() => { try { if (!approved && !localStorage.getItem(tipKey)) setTip(true); } catch {} }, []); // eslint-disable-line
  const hideTip = () => { setTip(false); try { localStorage.setItem(tipKey, '1'); } catch {} };
  const open = async () => {
    hideTip(); setErr('');
    if (signInHref) { const { data } = await supabase().auth.getSession(); if (!data.session) return setAsk('signin'); }
    setAsk('confirm');
  };
  const approve = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase().rpc('approve_version', { p_song: songId, p_version: versionId });
    setBusy(false);
    if (error) return setErr(/not allowed/i.test(error.message) ? 'Only the artist’s team can approve. Sign in with the email your engineer has for you.' : error.message);
    pingPush({ kind: 'approve', songId });
    setDone(true); setAsk(null); onDone?.();
  };
  if (done) return <span className="apvbtn done" aria-label={`${label || 'This mix'} is approved`}>{CHECK}<span>Approved</span></span>;
  return (
    <span className="apvwrap">
      {tip && <span className="apvtip" role="status" onClick={hideTip}>Happy with it? Approve it here<button aria-label="Got it" onClick={hideTip}>×</button></span>}
      <button type="button" className="apvbtn" onClick={open}>{CHECK}<span>Approve</span></button>
      {ask && typeof document !== 'undefined' && createPortal(
        <div className="qsheet" role="dialog" aria-modal="true" aria-label="Approve this mix" onClick={() => setAsk(null)}>
          <div className="qcard apvcard" onClick={(e) => e.stopPropagation()}>
            <span className="apvicon">{CHECK}</span>
            {ask === 'signin' ? <>
              <b>Sign in to approve</b>
              <p>Approving tells your engineer this mix is final. Sign in with the email your engineer has for you, and you’ll come right back here.</p>
              <a className="qok" href={signInHref}>Sign in</a>
              <button type="button" className="qno" onClick={() => setAsk(null)}>Not now</button>
            </> : <>
              <b>Approve {label || 'this mix'}{title ? ` of ${title}` : ''}?</b>
              <p>This tells your engineer it’s final. You can still leave notes, and they can reopen it if anything changes.</p>
              {err && <p className="ferr" style={{ margin: 0 }}>{err}</p>}
              <button type="button" className="qok apvok" disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Approve'}</button>
              <button type="button" className="qno" onClick={() => setAsk(null)}>Not yet</button>
            </>}
          </div>
        </div>, document.body)}
    </span>
  );
}

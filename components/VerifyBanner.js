'use client';
import { useEffect, useState } from 'react';
import { supabase, api } from '@/lib/supabase';

/** New accounts: prove the email is yours (6-digit code) before projects unlock. */
export default function VerifyBanner({ email, onDone }) {
  const [step, setStep] = useState('ask');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // came back from the “Confirm my email” link: pick up the change
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('confirmed') === '1') { supabase().auth.refreshSession().then(() => { onDone?.(); setStep('done'); }); history.replaceState(null, '', window.location.pathname); }
    else if (q.get('confirm') === 'expired') { setMsg('That confirmation link expired. Send a new one.'); history.replaceState(null, '', window.location.pathname); }
  }, []); // eslint-disable-line
  const sendLink = async () => {
    setBusy(true); setMsg('');
    try { await api('/api/confirm', {}); setStep('sent'); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true); setMsg('');
    let error = null;
    try {
      const r = await fetch('/api/signin-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); error = { message: j.error || 'Couldn’t send the code.' }; if (r.status >= 500) throw new Error(); }
    } catch { ({ error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })); }
    setBusy(false);
    if (error) return setMsg(/rate limit/i.test(error.message) ? 'Too many emails right now. Try again in a bit, or ask your engineer to confirm you.' : error.message);
    setStep('code');
  };
  const check = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await supabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) { setBusy(false); return setMsg('That code didn’t work. Check the latest email.'); }
    try { await api('/api/verify', { action: 'self' }); await supabase().auth.refreshSession(); onDone?.(); setStep('done'); }
    catch (er) { setMsg(er.message); }
    setBusy(false);
  };
  if (step === 'done') return null;
  return (
    <div className="verifybar" role="status">
      <div><b>Confirm it’s you to see your projects</b>
        <span>We emailed you a link when you signed up. Tap it once so CTRL ROOM knows this email is really yours. Or ask your engineer to confirm you.</span></div>
      {step === 'ask' ? <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small primary" disabled={busy} onClick={sendLink}>{busy ? 'Sending…' : 'Email me a confirmation link'}</button>
          <button className="btn small quiet" disabled={busy} onClick={send}>Use a code instead</button></span>
        : step === 'sent' ? <span className="small">Sent to <b>{email}</b>. Tap <b>Confirm my email</b> in it (check spam too). <button className="link small" onClick={sendLink} disabled={busy}>Send again</button></span>
        : <form onSubmit={check} className="lockform"><input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" autoFocus /><button className="btn small primary" disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Confirm'}</button></form>}
      {msg && <p className="ferr" style={{ margin: 0, flexBasis: '100%' }}>{msg}</p>}
    </div>
  );
}

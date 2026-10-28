'use client';
import { useState } from 'react';
import { supabase, api } from '@/lib/supabase';

/** New accounts: prove the email is yours (6-digit code) before projects unlock. */
export default function VerifyBanner({ email, onDone }) {
  const [step, setStep] = useState('ask');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    setBusy(true); setMsg('');
    const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
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
        <span>For your music’s safety, new accounts confirm their email once. Or ask your engineer to confirm you.</span></div>
      {step === 'ask'
        ? <button className="btn small primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : `Email a code to ${email}`}</button>
        : <form onSubmit={check} className="lockform"><input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" autoFocus /><button className="btn small primary" disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Confirm'}</button></form>}
      {msg && <p className="ferr" style={{ margin: 0, flexBasis: '100%' }}>{msg}</p>}
    </div>
  );
}

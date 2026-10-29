'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const DEVICE_KEY = 'ctrl-room:device';

/** On a remembered device, skip the code: returns true if this session now counts as two-step checked. */
export async function claimDevice() {
  try {
    const token = localStorage.getItem(DEVICE_KEY);
    if (!token) return false;
    const { data, error } = await supabase().rpc('claim_device', { p_token: token });
    if (error || !data) { if (!error) localStorage.removeItem(DEVICE_KEY); return false; }
    return true;
  } catch { return false; }
}

/** After signing in: if this account has two-step verification on, ask for the 6-digit code. */
export default function MfaGate({ onDone, onSignOut }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [remember, setRemember] = useState(true);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const sb = supabase();
      const { data: f, error: fe } = await sb.auth.mfa.listFactors();
      if (fe) throw fe;
      const factor = (f.totp || []).find((x) => x.status === 'verified');
      if (!factor) throw new Error('No authenticator is set up on this account.');
      const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId: factor.id });
      if (ce) throw ce;
      const { error: ve } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code: code.trim() });
      if (ve) throw new Error('That code didn’t work. Use the newest one in your authenticator app.');
      if (remember) {
        try {
          const b = new Uint8Array(32); crypto.getRandomValues(b);
          const token = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
          const label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : /CTRLROOM|Macintosh/.test(navigator.userAgent) ? 'Mac' : 'Computer';
          const { data: ok } = await sb.rpc('trust_device', { p_token: token, p_label: label });
          if (ok) localStorage.setItem(DEVICE_KEY, token);
        } catch { /* remembering is a convenience: never block sign-in */ }
      }
      onDone();
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <div className="login">
      <div className="logincard mfacard">
        <img src="/logo.png" alt="" className="loginlogo" />
        <h1 className="up">Two-step check</h1>
        <p>Open your authenticator app and enter the 6-digit code for CTRL ROOM.</p>
        <form onSubmit={submit} className="mfaform">
          <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Authenticator code" autoFocus />
          <label className="smsopt remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this device for 30 days</label>
          <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
        {err && <p className="ferr">{err}</p>}
        <button className="link muted" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

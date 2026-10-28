'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/** After signing in: if this account has two-step verification on, ask for the 6-digit code. */
export default function MfaGate({ onDone, onSignOut }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
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
      onDone();
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <div className="login">
      <div className="logincard">
        <img src="/logo.png" alt="" className="loginlogo" />
        <h1 className="up">Two-step check</h1>
        <p>Open your authenticator app and enter the 6-digit code for CTRL ROOM.</p>
        <form onSubmit={submit} className="lockform">
          <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Authenticator code" autoFocus />
          <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
        {err && <p className="ferr">{err}</p>}
        <button className="link muted" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { session } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState('');

  useEffect(() => { if (session) router.replace(next); }, [session, next, router]);

  const send = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter the email address your engineer has for you.');
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${next}`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setErr(/rate limit/i.test(error.message) ? 'Too many sign-in emails were sent in the last hour. Wait a bit and try once, or sign in with a password.' : error.message);
    setStep('code');
  };

  const verify = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr("That code didn't work. Check the latest email, or send a new one.");
    router.replace(next);
  };

  const signInPw = async (e) => {
    e.preventDefault();
    setErr('');
    if (!email.trim() || !pw) return setErr('Enter your email and password.');
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr("That email and password don't match.");
    router.replace(next);
  };

  return (
    <div className="login">
      <div className="logincard">
        <img src="/logo.png" alt="" className="loginlogo" />
        <h1 className="up">Ctrl Room</h1>
        {step === 'password' ? (
          <>
            <p>Sign in with your password.</p>
            <form onSubmit={signInPw} style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 340 }}>
              <input className="sinput" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
              <input className="sinput" type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" autoFocus />
              <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
            <button className="link muted" onClick={() => { setStep('email'); setErr(''); }}>Email me a sign-in link instead</button>
          </>
        ) : step === 'email' ? (
          <>
            <p>Sign in with your email. No password needed.</p>
            <form onSubmit={send} className="lockform">
              <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoFocus />
              <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Continue'}</button>
            </form>
            <button className="link muted" onClick={() => { setStep('password'); setErr(''); }}>Sign in with a password</button>
          </>
        ) : (
          <>
            <p>Check <b>{email}</b>. Tap the link in the email, or type the code from it here.</p>
            <form onSubmit={verify} className="lockform">
              <input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Sign-in code" autoFocus />
              <button className="btn primary" disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
            </form>
            <button className="link muted" onClick={() => { setStep('email'); setCode(''); }}>Use a different email</button>
          </>
        )}
        {err && <p className="ferr">{err}</p>}
        <p className="muted small authswitch">New here? <Link className="link" href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><Login /></Suspense>;
}

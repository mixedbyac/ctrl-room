'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';
import SpotifyField from '@/components/SpotifyField';
import { markEntering } from '@/components/EnterAnimation';

function Signup() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { session } = useApp();
  const [f, setF] = useState({ name: '', artist: params.get('artist') || '', email: params.get('email') || '', phone: '', spotify: '', password: '', website: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { if (session && !busy) router.replace(next); }, [session]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!f.name.trim()) return setErr('Add your name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Enter a valid email address.');
    if (f.password.length < 8) return setErr('Use a password with at least 8 characters.');
    setBusy(true);
    try {
      const r = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Couldn’t create your account. Try again.');
      const { error } = await supabase().auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.password });
      if (error) throw new Error('Your account is ready. Sign in with your email and password.');
      markEntering();
      router.replace(next);
    } catch (er) { setErr(er.message); setBusy(false); }
  };

  return (
    <div className="login">
      <div className="logincard signcard">
        <img src="/logo.png" alt="" className="loginlogo" />
        <h1 className="up">Create your account</h1>
        <p>For artists and their teams: send your files, listen to your mixes, leave notes and approve.</p>
        <p className="muted small" style={{ margin: 0 }}>Engineers join by invite.</p>
        <form onSubmit={submit} className="signform" noValidate>
          <div className="two">
            <div className="fld"><label htmlFor="su-n">Your name</label><input id="su-n" autoComplete="name" value={f.name} onChange={set('name')} autoFocus /></div>
            <div className="fld"><label htmlFor="su-a">Artist name <span className="opt">optional</span></label><input id="su-a" value={f.artist} onChange={set('artist')} /></div>
          </div>
          <SpotifyField id="su-s" label="Spotify artist link" value={f.spotify} onChange={(v) => setF((x) => ({ ...x, spotify: v }))} onArtist={(a) => setF((x) => ({ ...x, artist: x.artist.trim() ? x.artist : a.name || '' }))} />
          <div className="fld"><label htmlFor="su-e">Email</label><input id="su-e" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div>
          <div className="fld"><label htmlFor="su-p">Password <span className="opt">8+ characters</span></label>
            <div className="pwrow"><input id="su-p" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password} onChange={set('password')} />
              <button type="button" className="btn small quiet" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div></div>
          <div className="two">
            <div className="fld"><label htmlFor="su-ph">Phone <span className="opt">for text updates</span></label><input id="su-ph" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></div>

          </div>
          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} />
          <button className="btn primary" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
        </form>
        {err && <p className="ferr">{err}</p>}
        <p className="muted small">Already have an account? <Link className="link" href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link></p>
        <p className="muted small" style={{ marginTop: -6 }}>Use the email your engineer has for you, so your projects show up.</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense fallback={null}><Signup /></Suspense>;
}

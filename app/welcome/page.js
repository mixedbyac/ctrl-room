'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/** Where an invite email lands: pick a name and a password, then you're in. */
export default function Welcome() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const sb = supabase();
    const set = (s) => { setUser(s?.user || null); if (s?.user?.user_metadata?.name) setName(s.user.user_metadata.name); };
    sb.auth.getSession().then(({ data }) => set(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => set(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const go = async (e) => {
    e.preventDefault(); setErr('');
    if (!name.trim()) return setErr('Add your name.');
    if (pw.length < 8) return setErr('Use a password with at least 8 characters.');
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password: pw, data: { name: name.trim() } });
    setBusy(false);
    if (error) return setErr(error.message);
    router.replace('/');
  };
  const artist = user?.user_metadata?.artist;
  return (
    <div className="login"><div className="logincard signcard">
      <img src="/logo.png" alt="" className="loginlogo" />
      <h1 className="up">Welcome to CTRL ROOM</h1>
      {user === undefined ? <p className="muted">One sec…</p> : !user ? (
        <><p className="muted">This invite link has expired or was already used. Sign in, or ask your engineer to send a new one.</p>
          <a className="btn primary" href="/login">Sign in</a></>
      ) : (
        <form onSubmit={go} className="signform">
          <p className="muted">{artist ? <>You’ve been added to <b>{artist}</b>. </> : null}Set your name and a password so you can sign in any time.</p>
          <div className="fld"><label htmlFor="w-e">Email</label><input id="w-e" value={user.email} disabled /></div>
          <div className="fld"><label htmlFor="w-n">Your name</label><input id="w-n" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus /></div>
          <div className="fld"><label htmlFor="w-p">Password</label><input id="w-p" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} /></div>
          {err && <p className="ferr">{err}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Enter the CTRL ROOM'}</button>
        </form>
      )}
    </div></div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';

export default function SecurityPage() {
  const { session, eng } = useApp();
  const [factors, setFactors] = useState(null);
  const [enroll, setEnroll] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [health, setHealth] = useState(undefined);
  const sb = supabase();
  useEffect(() => { if (eng) api('/api/health', {}).then((r) => setHealth(r.last)).catch(() => setHealth(null)); }, [eng]);

  const load = async () => {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) return setMsg(error.message);
    setFactors((data.totp || []).filter((f) => f.status === 'verified'));
    // clear half-finished setups so starting again works
    for (const f of data.all || []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
  };
  useEffect(() => { if (session) load(); }, [session]); // eslint-disable-line

  const start = async () => {
    setMsg(''); setBusy(true);
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `CTRL ROOM ${new Date().toISOString().slice(0, 10)}`, issuer: 'CTRL ROOM' });
    setBusy(false);
    if (error) return setMsg(/disabled|not enabled/i.test(error.message) ? 'Two-step isn’t switched on in Supabase yet: Authentication › Multi-Factor › enable TOTP.' : error.message);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirm = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId: enroll.id });
    if (ce) { setBusy(false); return setMsg(ce.message); }
    const { error } = await sb.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (error) return setMsg('That code didn’t work. Use the newest one in the app.');
    setEnroll(null); setCode(''); setMsg('Two-step verification is on. You’ll enter a code from your app each time you sign in.');
    load();
  };
  const remove = async (f) => {
    if (!window.confirm('Turn off two-step verification? Your account will only need your password or email code.')) return;
    const { error } = await sb.auth.mfa.unenroll({ factorId: f.id });
    setMsg(error ? error.message : 'Two-step verification is off.');
    await sb.auth.refreshSession(); load();
  };

  if (!session) return null;
  const on = factors && factors.length > 0;
  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Security' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">Security</h1><p className="lede">Keep your account, and your music, locked to you.</p></div>
        <div className="panel secpanel">
          <div className="shrow">
            <span><b>Two-step verification</b><span className="muted small">{on ? 'On. Signing in also needs a code from your authenticator app.' : 'Off. Turn it on so a stolen password isn’t enough to get in.'}</span></span>
            <span className={`secbadge ${on ? 'on' : ''}`}>{factors === null ? '…' : on ? 'ON' : 'OFF'}</span>
          </div>
          {!on && !enroll && <button className="btn primary" disabled={busy || factors === null} onClick={start}>{busy ? 'Starting…' : 'Turn on two-step verification'}</button>}
          {enroll && (
            <div className="secenroll">
              <ol>
                <li>Open an authenticator app: the iPhone Passwords app, Google Authenticator, 1Password or Authy.</li>
                <li>Scan this code (or type the key below).</li>
                <li>Enter the 6-digit code it shows.</li>
              </ol>
              <img src={enroll.qr} alt="Scan this with your authenticator app" className="secqr" />
              <code className="seckey">{enroll.secret}</code>
              <form onSubmit={confirm} className="lockform">
                <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Code from the app" />
                <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Turn on'}</button>
              </form>
            </div>
          )}
          {on && factors.map((f) => (
            <div key={f.id} className="shrow"><span><b>{f.friendly_name || 'Authenticator app'}</b><span className="muted small">Added {new Date(f.created_at).toLocaleDateString()}</span></span>
              <button className="btn small quiet" onClick={() => remove(f)}>Turn off</button></div>
          ))}
          {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
        </div>
        {eng && (
          <div className="panel secpanel">
            <div className="shrow"><span><b>Daily check</b><span className="muted small">Every morning CTRL ROOM checks the database, music storage, sign-in, Dropbox and texting, and texts you if something breaks.</span></span>
              {health && <span className={`secbadge ${health.ok ? 'on' : ''}`}>{health.ok ? 'ALL GOOD' : 'PROBLEM'}</span>}</div>
            {health === undefined ? <p className="muted small" style={{ margin: 0 }}>Loading…</p>
              : !health ? <p className="muted small" style={{ margin: 0 }}>No check has run yet. The first one runs tomorrow morning.</p>
              : <ul className="healthlist">{health.checks.map((c) => <li key={c.name} className={c.ok ? 'ok' : 'bad'}><span>{c.ok ? '●' : '▲'}</span><b>{c.name}</b><small>{c.ok ? (c.note || 'working') : c.note}</small></li>)}
                  <li className="when"><small>Last checked {new Date(health.at).toLocaleString()}</small></li></ul>}
          </div>
        )}
        {eng && <LoginCovers />}
        <div className="panel secpanel">
          <b>How your music is protected</b>
          <ul className="seclist">
            <li>Mixes are stored privately. Every play uses a link that expires, made only for people on that project.</li>
            <li>Other artists can never see your projects. The database checks this on every request, not just the website.</li>
            <li>New accounts confirm their email before any project unlocks.</li>
            <li>Share links only play the current mix, never notes or other versions, and {eng ? 'you can turn them off or reset them' : 'your engineer can turn them off'} any time.</li>
            <li>Everything travels encrypted (HTTPS), and the site blocks being embedded or scripted by other sites.</li>
          </ul>
          <a className="link small" href="/protect">Read how CTRL ROOM protects your music ›</a>
        </div>
      </section>
    </>
  );
}

function LoginCovers() {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (clear = false) => {
    setBusy(true); setMsg('');
    try { const r = await api('/api/covers', { url: clear ? '' : url }); setMsg(clear ? 'Back to your default playlist (The Engineer’s).' : `Using ${r.covers} covers from that playlist. Open the sign-in page to see them.`); if (clear) setUrl(''); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="panel secpanel">
      <b>Sign-in page covers</b>
      <span className="muted small">Paste a public Apple Music playlist. Its cover art drifts quietly behind the sign-in page, and each cover links to the album. It refreshes once a day.</span>
      <div className="aerow"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://music.apple.com/us/playlist/…" />
        <button className="btn small primary" disabled={busy || !url.trim()} onClick={() => save(false)}>{busy ? 'Loading…' : 'Use playlist'}</button>
        <button className="btn small quiet" disabled={busy} onClick={() => save(true)}>Clear</button></div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

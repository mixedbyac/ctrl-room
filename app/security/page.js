'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase, api } from '@/lib/supabase';
import { ENGINEER_KINDS, CLIENT_KINDS, prefOf } from '@/lib/notify';
import { useApp, TopBar } from '@/components/AppShell';
import ProfileForm from '@/components/ProfileForm';
import { shrink } from '@/components/ArtistProfile';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SettingsPage() { return <Suspense fallback={null}><Settings /></Suspense>; }

function Settings() {
  const { session, eng } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const tabs = [['profile', eng ? 'Profile' : 'Account'], ['notifications', 'Notifications'], ['security', 'Security'], ...(eng ? [['studio', 'Studio']] : [])];
  const hashTab = typeof window !== 'undefined' && window.location.hash === '#notifications' ? 'notifications' : null;
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : hashTab || 'profile';
  const go = (k) => router.replace(`/settings?tab=${k}`, { scroll: false });
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
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">Settings</h1></div>
        <div className="npdtabs settabs" role="tablist" aria-label="Settings">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}>{l}</button>)}
        </div>
        {tab === 'profile' && (eng ? <ProfileForm /> : <AccountBasics session={session} />)}
        {tab === 'notifications' && <NotifySettings eng={eng} session={session} />}
        {tab === 'security' && <>
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
        <RememberedDevices />
        <ProtectionInfo eng={eng} />
        </>}
        {tab === 'studio' && eng && <>
        {(
          <div className="panel secpanel">
            <div className="shrow"><span><b>Daily check</b><span className="muted small">Every morning CTRL ROOM checks the database, music storage, sign-in, Dropbox and email, and emails you if something breaks.</span></span>
              {health && <span className={`secbadge ${health.ok ? 'on' : ''}`}>{health.ok ? 'ALL GOOD' : 'PROBLEM'}</span>}</div>
            {health === undefined ? <p className="muted small" style={{ margin: 0 }}>Loading…</p>
              : !health ? <p className="muted small" style={{ margin: 0 }}>No check has run yet. The first one runs tomorrow morning.</p>
              : <ul className="healthlist">{health.checks.map((c) => <li key={c.name} className={c.ok ? 'ok' : 'bad'}><span>{c.ok ? '●' : '▲'}</span><b>{c.name}</b><small>{c.ok ? (c.note || 'working') : c.note}</small></li>)}
                  <li className="when"><small>Last checked {new Date(health.at).toLocaleString()}</small></li></ul>}
          </div>
        )}
        <EmailSetup />
        <Engineers />
        <LoginCovers />
        </>}
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

function NotifySettings({ eng, session }) {
  const [n, setN] = useState(() => session?.user?.user_metadata?.notify || {});
  const [msg, setMsg] = useState('');
  const kinds = eng ? ENGINEER_KINDS : CLIENT_KINDS;
  const flip = async (kind, ch) => {
    const next = { ...n, [kind]: { ...(n[kind] || {}), [ch]: !prefOf(n, kind, ch) } };
    setN(next);
    const { error } = await supabase().auth.updateUser({ data: { notify: next } });
    setMsg(error ? error.message : 'Saved.'); setTimeout(() => setMsg(''), 1500);
  };
  return (
    <div className="panel secpanel" id="notifications">
      <b>Notifications</b>
      <span className="muted small">Choose what shows in your bell (in the app) and what gets emailed to you.</span>
      <div className="notifgrid">
        <span /><span className="nghead">In the app</span><span className="nghead">Email</span>
        {kinds.map(([k, label, sub]) => (
          <div key={k} className="ngrow">
            <span className="ngtext"><b>{label}</b><small>{sub}</small></span>
            <button type="button" className="switch" role="switch" aria-checked={prefOf(n, k, 'app')} aria-label={`${label} in the app`} onClick={() => flip(k, 'app')}><i /></button>
            <button type="button" className="switch" role="switch" aria-checked={prefOf(n, k, 'email')} aria-label={`${label} by email`} onClick={() => flip(k, 'email')}><i /></button>
          </div>
        ))}
      </div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

function ProtectionInfo({ eng }) {
  return (
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
  );
}

/** Everyone: your name, display name and photo. */
function AccountBasics({ session }) {
  const md = session?.user?.user_metadata || {};
  const [name, setName] = useState(md.name || '');
  const [display, setDisplay] = useState(md.display_name || '');
  const [photo, setPhoto] = useState(md.avatar_url || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileIn = useRef(null);
  const verified = !session?.user?.app_metadata?.needs_verify;
  const after = async (r, m) => { setMsg(m); await supabase().auth.refreshSession().catch(() => {}); return r; };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api('/api/me', { action: 'save', name, display_name: display }); await after(null, 'Saved.'); } catch (er) { setMsg(er.message); }
    setBusy(false);
  };
  const pick = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true);
    shrink(f, 800).then((dataUrl) => api('/api/me', { action: 'photo', dataUrl })).then((r) => { setPhoto(r.user_metadata?.avatar_url || ''); return after(r, 'Photo updated.'); }).catch((er) => setMsg(er.message)).finally(() => setBusy(false));
  };
  const shown = display || name || (session?.user?.email || '').replace(/@.*/, '');
  return (
    <form className="panel secpanel" onSubmit={save}>
      <div className="profcard" style={{ background: 'none', border: 0, padding: 0 }}>
        <span className="profav">{photo ? <img src={photo} alt="" /> : (shown[0] || '?').toUpperCase()}</span>
        <div>
          <b className="profname">{shown}</b>
          <span className="profmail">{session?.user?.email} · {verified ? <span className="vok">Verified</span> : <span className="vno">Not confirmed yet</span>}</span>
          <div className="row-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn small" onClick={() => fileIn.current?.click()} disabled={busy}>{photo ? 'Change photo' : 'Add a photo'}</button>
            {photo && <button type="button" className="btn small quiet" disabled={busy} onClick={() => api('/api/me', { action: 'clear-photo' }).then((r) => { setPhoto(''); return after(r, 'Photo removed.'); }).catch((er) => setMsg(er.message))}>Remove</button>}
          </div>
        </div>
      </div>
      <input ref={fileIn} type="file" accept="image/*" hidden onChange={pick} />
      <div className="two">
        <div className="fld"><label htmlFor="ac-n">Full name</label><input id="ac-n" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        <div className="fld"><label htmlFor="ac-d">Display name <span className="opt">what people see</span></label><input id="ac-d" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder={name || 'How you go by'} /></div>
      </div>
      <div className="row-actions"><button className="btn small primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </form>
  );
}

function RememberedDevices() {
  const [msg, setMsg] = useState('');
  const forget = async () => {
    if (!window.confirm('Forget every remembered device? You’ll enter your 6-digit code again on each one.')) return;
    const { data, error } = await supabase().rpc('forget_devices');
    try { localStorage.removeItem('ctrl-room:device'); } catch {}
    setMsg(error ? (/forget_devices/.test(error.message) ? 'Run supabase/016_remember_device.sql in Supabase first.' : error.message) : `Done. ${data || 0} device${data === 1 ? '' : 's'} forgotten.`);
  };
  return (
    <div className="panel secpanel">
      <b>Remembered devices</b>
      <span className="muted small">When you tick “Remember this device” on the two-step check, that browser or app skips the code for 30 days. Your password is still needed. Lost a device? Forget them all here.</span>
      <div className="row-actions"><button className="btn small" onClick={forget}>Forget remembered devices</button></div>
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

function EmailSetup() {
  const [st, setSt] = useState(null);
  useEffect(() => { api('/api/invite', { check: true }).then(setSt).catch((e) => setSt({ email: null, error: e.message })); }, []);
  return (
    <div className="panel secpanel" id="email">
      <b>Email invites {st && (st.email ? <span className="tbadge ok">✓ On · from {st.from}</span> : st.email === null ? <span className="tbadge">Couldn’t check</span> : <span className="tbadge warn">Not set up</span>)}</b>
      {st?.error && <span className="ferr small">Couldn’t check the email setup: {st.error}. Your settings are still saved; refresh to try again.</span>}
      <span className="muted small">CTRL ROOM sends sign-up invites to artists itself. Until this is set up, you get an invite link to copy and text instead.</span>
      {st && st.email === false && (
        <p className="small" style={{ margin: 0 }}>CTRL ROOM sees: <b>RESEND_API_KEY</b> {st.hasKey ? '✓ found' : '✗ missing'} · <b>EMAIL_FROM</b> {st.hasFrom ? '✓ found' : '✗ missing'}</p>
      )}
      {st && st.email === false && (
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Make a free account at <a className="link" href="https://resend.com" target="_blank" rel="noopener noreferrer">resend.com</a>.</li>
          <li>Domains › Add domain, and wait for it to say <b>Verified</b>.</li>
          <li>API Keys › Create API key (Sending access).</li>
          <li>In Vercel › ctrl-room › Settings › Environment Variables, add <code>RESEND_API_KEY</code> (the key) and <code>EMAIL_FROM</code> = <code>CTRL ROOM &lt;mix@ctrl-room.app&gt;</code>, then Redeploy.</li>
        </ol>
      )}
    </div>
  );
}

function Engineers() {
  const [st, setSt] = useState(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const call = async (body) => {
    try {
      const r = await api('/api/engineers', body); setSt(r);
      if (body.action === 'add') {
        if (r.invite && !r.invite.sent && r.invite.link) { try { await navigator.clipboard.writeText(r.invite.link); } catch {} }
        setMsg(r.invite?.sent ? `Added. ${body.email} got an invite email to set up their engineer account.` : `Added. Email isn’t going out, so their invite link is copied. Text it to ${body.email}.`);
      } else setMsg(body.action === 'remove' ? 'Removed.' : '');
    } catch (e) { setMsg(e.message); }
  };
  useEffect(() => { call({ action: 'list' }); }, []);
  return (
    <div className="panel secpanel">
      <b>Engineers</b>
      <span className="muted small">People with full engineer access to this CTRL ROOM: every project, the Portal inbox, Dropbox, invoices and Insights. Good for an assistant or co-engineer. For someone running their own clients, ask for their own CTRL ROOM instead.</span>
      <ul className="team">
        {(st?.list || []).map((e) => (
          <li key={e.email}><span className="tav">{e.email[0].toUpperCase()}</span><span className="tmain"><b>{e.email}</b><small>{e.owner ? 'Main engineer' : 'Engineer'}</small></span>
            {st.owner && !e.owner && <button className="btn small quiet" onClick={() => { if (window.confirm(`Remove ${e.email} as an engineer?`)) call({ action: 'remove', email: e.email }); }}>Remove</button>}</li>
        ))}
      </ul>
      {st?.owner && (
        <form className="teamadd" onSubmit={(e) => { e.preventDefault(); if (email.trim()) { call({ action: 'add', email: email.trim() }); setEmail(''); } }}>
          <input type="email" placeholder="assistant@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Engineer email" />
          <button className="btn small primary">Add engineer</button>
        </form>
      )}
      {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

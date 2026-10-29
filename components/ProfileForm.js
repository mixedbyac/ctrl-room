'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';
import Credit, { BlueCheck } from '@/components/Credit';
import { ROLES, creditLine } from '@/lib/credit';
import { TitleInput } from '@/components/TitleCase';
import { shrink } from '@/components/ArtistProfile';

export default function ProfileForm() {
  const { eng, session } = useApp();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileIn = useRef(null);
  useEffect(() => {
    if (!session || !eng) return;
    api('/api/profile', { action: 'get' }).then((r) => setF({ full_name: '', display_name: '', credit: '', bio: '', photo_url: '', roles: ['mix'], ...r.profile, roles: r.profile?.roles?.length ? r.profile.roles : ['mix'] })).catch((e) => { setMsg(e.message); setF({ roles: ['mix'] }); });
  }, [session, eng]);
  if (!session) return null;
  if (!eng) return null;
  if (!f) return <p className="muted">Loading…</p>;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: typeof v === 'string' ? v : v.target.value }));
  const toggleRole = (r) => setF((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r = await api('/api/profile', { action: 'save', ...f, instagram: f.instagram_draft ?? f.instagram ?? '' }); setF((x) => ({ ...x, ...r.profile })); setMsg('Saved. Your credit shows on your projects.'); window.dispatchEvent(new Event('ctrl-room:profile')); }
    catch (er) { setMsg(er.message); }
    setBusy(false);
  };
  const photo = async (body) => {
    setBusy(true); setMsg('');
    try { const r = await api('/api/profile', body); setF((x) => ({ ...x, photo_url: r.profile.photo_url, instagram: r.profile.instagram || x.instagram })); setMsg('Photo updated.'); window.dispatchEvent(new Event('ctrl-room:profile')); }
    catch (er) { setMsg(er.message); }
    setBusy(false);
  };
  const pick = (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) shrink(file, 800).then((dataUrl) => photo({ action: 'photo', dataUrl })).catch((er) => setMsg(er.message)); };
  const preview = { ...f, credit: f.credit, email: session.user.email };
  return (
    <>
      <section className="setsec">
        <p className="muted small" style={{ margin: '0 0 12px' }}>How you’re credited on every project you work on.</p>
        <div className="profcard">
          <span className="profav">
            {f.photo_url ? <img src={f.photo_url} alt="" /> : (f.display_name || f.full_name || session.user.email)[0].toUpperCase()}
          </span>
          <div>
            <b className="profname">{f.display_name || f.full_name || 'Your name'}{f.verified && <BlueCheck title="Verified engineer" />}</b>
            <span className="profmail">{session.user.email} · {f.verified ? <span className="vok">Verified</span> : <span className="vno">Not verified yet. Sign in with an email link or confirm your email to get the blue check.</span>}</span>
            <Credit profile={preview} className="big" />
          </div>
        </div>
        <form className="panel" onSubmit={save} style={{ marginTop: 18 }}>
          <div className="two">
            <div className="fld"><label htmlFor="pf-f">Full name</label><TitleInput id="pf-f" value={f.full_name || ''} onChange={set('full_name')} placeholder="Anthony Carballo" /></div>
            <div className="fld"><label htmlFor="pf-d">Display name <span className="opt">what people see</span></label><TitleInput id="pf-d" value={f.display_name || ''} onChange={set('display_name')} placeholder="AC" /></div>
          </div>
          <div className="fld"><label>What you do</label>
            <div className="rolepick">{ROLES.map(([k, l]) => <label key={k} className={`rolechip ${f.roles.includes(k) ? 'on' : ''}`}><input type="checkbox" checked={f.roles.includes(k)} onChange={() => toggleRole(k)} />{l}</label>)}</div></div>
          <div className="fld"><label htmlFor="pf-c">Credit <span className="opt">leave blank for “{creditLine({ ...f, credit: '' })}”</span></label><input id="pf-c" value={f.credit || ''} onChange={set('credit')} placeholder={creditLine({ ...f, credit: '' })} maxLength={120} /></div>
          <div className="fld"><label>Profile picture</label>
            <div className="photorow">
              <button type="button" className="btn small" onClick={() => fileIn.current?.click()} disabled={busy}>Upload a photo</button>
              <span className="muted small">Instagram (shows on your credit card; tap Use it for your picture):</span>
              <span className="igrow"><span className="igat">@</span><input value={f.instagram_draft ?? f.instagram ?? ''} onChange={(e) => setF((x) => ({ ...x, instagram_draft: e.target.value }))} placeholder="yourhandle" aria-label="Instagram username" autoCapitalize="none" />
                <button type="button" className="btn small" disabled={busy || !(f.instagram_draft ?? f.instagram)} onClick={() => photo({ action: 'instagram', handle: f.instagram_draft ?? f.instagram })}>Use it</button></span>
              {f.photo_url && <button type="button" className="link small" onClick={() => setF((x) => ({ ...x, photo_url: '' }))}>Remove photo (then Save)</button>}
            </div></div>
          <div className="fld"><label htmlFor="pf-b">About you <span className="opt">optional</span></label><textarea id="pf-b" rows={3} value={f.bio || ''} onChange={set('bio')} maxLength={600} /></div>
          <div className="row-actions"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
        </form>
        <input ref={fileIn} type="file" accept="image/*" hidden onChange={pick} />
      </section>
    </>
  );
}

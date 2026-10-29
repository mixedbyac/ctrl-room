'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Credit, { BlueCheck } from '@/components/Credit';
import { ROLES, creditLine } from '@/lib/credit';
import { TitleInput } from '@/components/TitleCase';

export default function ProfilePage() {
  const { eng, session } = useApp();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session || !eng) return;
    api('/api/profile', { action: 'get' }).then((r) => setF({ full_name: '', display_name: '', credit: '', bio: '', photo_url: '', roles: ['mix'], ...r.profile, roles: r.profile?.roles?.length ? r.profile.roles : ['mix'] })).catch((e) => { setMsg(e.message); setF({ roles: ['mix'] }); });
  }, [session, eng]);
  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Profile' }]} /><section className="page"><p className="muted">Engineer profiles are for engineers.</p></section></>;
  if (!f) return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Your profile' }]} /><section className="page"><p className="muted">Loading…</p></section></>;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: typeof v === 'string' ? v : v.target.value }));
  const toggleRole = (r) => setF((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r = await api('/api/profile', { action: 'save', ...f }); setF((x) => ({ ...x, ...r.profile })); setMsg('Saved. Your credit shows on your projects.'); window.dispatchEvent(new Event('ctrl-room:profile')); }
    catch (er) { setMsg(er.message); }
    setBusy(false);
  };
  const preview = { ...f, credit: f.credit, email: session.user.email };
  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Your profile' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">Your profile</h1><p className="lede">How you’re credited on every project you work on.</p></div>
        <div className="profcard">
          <span className="profav">{f.photo_url ? <img src={f.photo_url} alt="" /> : (f.display_name || f.full_name || session.user.email)[0].toUpperCase()}</span>
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
          <div className="fld"><label htmlFor="pf-p">Photo link <span className="opt">optional, a square picture</span></label><input id="pf-p" type="url" value={f.photo_url || ''} onChange={set('photo_url')} placeholder="https://…" /></div>
          <div className="fld"><label htmlFor="pf-b">About you <span className="opt">optional</span></label><textarea id="pf-b" rows={3} value={f.bio || ''} onChange={set('bio')} maxLength={600} /></div>
          <div className="row-actions"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          {msg && <p className="toast-inline" style={{ margin: 0 }}>{msg}</p>}
        </form>
      </section>
    </>
  );
}

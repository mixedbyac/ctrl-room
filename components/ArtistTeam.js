'use client';
import { SITE_URL } from '@/lib/site';
import { useEffect, useState } from 'react';
import { supabase, api } from '@/lib/supabase';
import { BlueCheck } from '@/components/Credit';

const ROLES = ['Artist', 'Admin', 'Manager', 'Producer', 'Writer', 'Label', 'A&R', 'Other'];
const ABOUT = { Artist: 'An artist on this team (there can be more than one). A verified Artist verifies the page.', Admin: 'Can manage the team, cover art, titles and track order' };

/** Who's on an artist's team. The engineer and the team's Artists / Admins can manage it; everyone added gets an email. */
export default function ArtistTeam({ artist, projects, eng = true }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Artist');
  const [msg, setMsg] = useState('');
  const [acct, setAcct] = useState({});
  const [myRole, setMyRole] = useState(null);
  const load = () => api('/api/team', { action: 'list', artist }).then((r) => { setRows(r.list || []); setMyRole(r.myRole || null); }).catch((e) => { setRows([]); setMsg(e.message); });
  useEffect(() => { load(); }, [artist]); // eslint-disable-line

  const contacts = [...new Set(projects.map((p) => (p.client_email || '').toLowerCase()).filter(Boolean))];
  const everyone = [...new Set([...contacts, ...(rows || []).map((r) => r.email.toLowerCase())])];
  useEffect(() => {
    if (!everyone.length || !eng) return; // account status is for the engineer
    api('/api/verify', { action: 'status', emails: everyone }).then((r) => setAcct(r.status || {})).catch(() => {});
  }, [everyone.join(',')]); // eslint-disable-line
  const confirmAcct = async (em) => {
    if (!window.confirm(`Confirm ${em}? Only do this if you know this account really belongs to them.`)) return;
    try { const r = await api('/api/verify', { action: 'confirm', email: em, artist }); setAcct((a) => ({ ...a, [em]: 'confirmed' })); if (r.invited && !r.invited.sent && r.invited.link) { try { await navigator.clipboard.writeText(r.invited.link); } catch {} }
      setMsg(r.invited ? (r.invited.sent ? `${em} is verified and got an email invite to join.` : `${em} is verified. Email isn’t set up, so their invite link is copied. Text it to them.`) : `${em} is verified and can see ${artist}’s projects.`); }
    catch (e) { setMsg(e.message); }
  };
  const Badge = ({ em }) => {
    const st = acct[em];
    if (st === 'unconfirmed') return <span className="row-actions"><span className="tbadge warn">Not confirmed</span><button className="btn small" onClick={() => confirmAcct(em)}>Verify</button></span>;
    if (st === 'invited') return <span className="row-actions"><span className="tbadge">Invited, hasn’t joined</span><button className="btn small" onClick={() => confirmAcct(em)}>Verify</button></span>;
    if (st === 'none') return <span className="row-actions"><span className="tbadge">No account yet</span><button className="btn small" onClick={() => confirmAcct(em)} title="Marks them verified and emails an invite to join">Verify &amp; invite</button></span>;
    if (st === 'confirmed') return <span className="tbadge ok" title="Signed up with this email and confirmed it"><BlueCheck kind="user" /> Verified</span>;
    return null;
  };
  const add = async (e) => {
    e.preventDefault(); setMsg('');
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setMsg('Enter a valid email.');
    if (rows?.some((r) => r.email.toLowerCase() === em)) return setMsg('They’re already on the team.');
    try {
      const r = await api('/api/team', { action: 'add', artist, email: em, role });
      setRows(r.list || []); setEmail('');
      setMsg(`Added. ${em} can now open ${artist}’s projects${r.notified ? ' and got an email letting them know' : r.link ? '. Email didn’t go out, so share this sign-up link with them' : ''}.`);
      if (!r.notified && r.link) { try { await navigator.clipboard.writeText(r.link); } catch {} }
    } catch (e2) { setMsg(e2.message); }
  };
  const remove = async (r) => {
    if (!confirm(`Remove ${r.email} from ${artist}’s team? They’ll lose access to these projects.`)) return;
    try { const x = await api('/api/team', { action: 'remove', artist, id: r.id }); setRows(x.list || []); } catch (e) { setMsg(e.message); }
  };
  const invite = (em) => `${SITE_URL}/signup?email=${encodeURIComponent(em)}`;
  const sendInvite = async (em) => {
    setMsg('Sending…');
    try {
      const r = await api('/api/invite', { artist, emails: [em], role: rows?.find((x) => x.email.toLowerCase() === em.toLowerCase())?.role || 'Admin', verify: false });
      const x = r.results?.[0] || {};
      if (!x.sent && x.link) { try { await navigator.clipboard.writeText(x.link); } catch {} }
      setMsg(x.sent ? `Invite emailed to ${em}.` : `Couldn’t email ${em}${x.message ? ` (${x.message})` : ''}. Their invite link is copied, text it to them.`);
    } catch (e) { setMsg(e.message); }
  };
  const copy = async (em) => { try { await navigator.clipboard.writeText(invite(em)); setMsg('Sign-up link copied.'); } catch {} };

  return (
    <section className="asec">
      <h2 className="h2 up">Team</h2>
      <p className="muted small" style={{ margin: '0 0 12px' }}>Everyone here can listen, comment, and add songs and files to {artist}’s projects. Make someone an <b>Admin</b> to let them change cover art, track order, titles and the active version. Other artists never see any of it.</p>
      <ul className="team">
        {contacts.map((em) => (
          <li key={`c-${em}`}><span className="tav">{em[0].toUpperCase()}</span><span className="tmain"><b>{em}</b><small>Project contact</small></span><span className="tctl"><Badge em={em} /></span></li>
        ))}
        {(rows || []).filter((r) => !contacts.includes(r.email.toLowerCase())).map((r) => (
          <li key={r.id}><span className="tav">{r.email[0].toUpperCase()}</span><span className="tmain"><b>{r.email}</b><small>{/^artist$/i.test(r.role || '') ? 'The artist · their verified account verifies the artist page' : /^admin$/i.test(r.role || '') ? 'Admin · can edit cover art, track order, titles and the active version' : r.role || 'Team'}</small></span>
            <span className="tctl"><Badge em={r.email.toLowerCase()} /><select className="trole" value={r.role || 'Other'} aria-label="Role" onChange={async (e) => { try { const x = await api('/api/team', { action: 'role', artist, id: r.id, role: e.target.value }); setRows(x.list || []); } catch (er) { setMsg(er.message); } }}>{ROLES.map((x) => <option key={x}>{x}</option>)}</select>
            <span className="row-actions">{eng && <button className="btn small quiet" onClick={() => sendInvite(r.email)}>Send invite</button>}<button className="btn small quiet" onClick={() => remove(r)}>Remove</button></span></span></li>
        ))}
        {rows && !rows.length && !contacts.length && <li className="muted small">No one yet.</li>}
      </ul>
      <form className="teamadd" onSubmit={add}>
        <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Team member email" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn small primary">Add to team</button>
      </form>
      {msg && <p className="toast-inline">{msg}</p>}
    </section>
  );
}

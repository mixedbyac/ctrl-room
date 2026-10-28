'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ROLES = ['Artist', 'Manager', 'Producer', 'Writer', 'Label', 'A&R', 'Other'];

/** Engineer only: who's on an artist's team. Team members can open all of the artist's projects and add to them in the Portal. */
export default function ArtistTeam({ artist, projects }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Artist');
  const [msg, setMsg] = useState('');
  const load = () => supabase().from('artist_members').select('*').ilike('artist', artist).order('added_at').then(({ data, error }) => {
    if (error) { setRows([]); setMsg(/artist_members/.test(error.message) ? 'Teams need a quick database update: run supabase/006_artist_team.sql in Supabase.' : error.message); return; }
    setRows((data || []).filter((r) => r.artist.toLowerCase() === artist.toLowerCase()));
  });
  useEffect(() => { load(); }, [artist]); // eslint-disable-line

  const contacts = [...new Set(projects.map((p) => (p.client_email || '').toLowerCase()).filter(Boolean))];
  const add = async (e) => {
    e.preventDefault(); setMsg('');
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setMsg('Enter a valid email.');
    if (rows?.some((r) => r.email.toLowerCase() === em)) return setMsg('They’re already on the team.');
    const { error } = await supabase().from('artist_members').insert({ artist, email: em, role });
    if (error) return setMsg(/artist_members/.test(error.message) ? 'Run supabase/006_artist_team.sql in Supabase first.' : error.message);
    setEmail(''); setMsg(`Added. ${em} can now open ${artist}’s projects and add to them in the Portal.`);
    load();
  };
  const remove = async (r) => {
    if (!confirm(`Remove ${r.email} from ${artist}’s team? They’ll lose access to these projects.`)) return;
    await supabase().from('artist_members').delete().eq('id', r.id);
    load();
  };
  const invite = (em) => `${window.location.origin}/signup?email=${encodeURIComponent(em)}`;
  const copy = async (em) => { try { await navigator.clipboard.writeText(invite(em)); setMsg('Sign-up link copied.'); } catch {} };

  return (
    <section className="asec">
      <h2 className="h2 up">Team</h2>
      <p className="muted small" style={{ margin: '0 0 12px' }}>Everyone here can listen, leave notes, and add songs and files to {artist}’s projects. Other artists never see them.</p>
      <ul className="team">
        {contacts.map((em) => (
          <li key={`c-${em}`}><span className="tav">{em[0].toUpperCase()}</span><span className="tmain"><b>{em}</b><small>Project contact</small></span></li>
        ))}
        {(rows || []).filter((r) => !contacts.includes(r.email.toLowerCase())).map((r) => (
          <li key={r.id}><span className="tav">{r.email[0].toUpperCase()}</span><span className="tmain"><b>{r.email}</b><small>{r.role || 'Team'}</small></span>
            <span className="row-actions"><button className="btn small quiet" onClick={() => copy(r.email)}>Copy invite</button><button className="btn small quiet" onClick={() => remove(r)}>Remove</button></span></li>
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

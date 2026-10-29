'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import { BlueCheck } from '@/components/Credit';
import { useArtists } from '@/components/TitleCase';
import { ago } from '@/lib/format';

/** Engineer: everyone who has a CTRL ROOM account, who they're with, and quick ways to add them to an artist. */
export default function PeoplePage() {
  const { eng, session } = useApp();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');
  const artists = useArtists();
  const load = () => api('/api/people', { action: 'list' }).then((r) => setList(r.people || [])).catch((e) => { setErr(e.message); setList([]); });
  useEffect(() => { if (session && eng) load(); }, [session, eng]); // eslint-disable-line
  const shown = useMemo(() => (list || []).filter((p) => {
    if (filter === 'new' && p.artists.length) return false;
    if (filter === 'teams' && (!p.artists.length || p.engineer)) return false;
    if (filter === 'engineers' && !p.engineer) return false;
    if (filter === 'unverified' && p.state === 'verified') return false;
    const t = q.trim().toLowerCase();
    return !t || [p.name, p.full_name, p.email, p.artistHint, ...p.artists.map((a) => a.artist)].some((x) => String(x || '').toLowerCase().includes(t));
  }), [list, q, filter]);
  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'People' }]} /><section className="page"><p className="muted">This page is for engineers.</p></section></>;
  const counts = { all: list?.length || 0, new: (list || []).filter((p) => !p.artists.length && !p.engineer).length };
  const add = async (p, artist) => {
    if (!artist) return;
    try { await api('/api/people', { action: 'add', email: p.email, artist }); setMsg(`${p.name || p.email} is now on ${artist}’s team.`); load(); } catch (e) { setMsg(e.message); }
  };
  const verify = async (p) => { try { await api('/api/verify', { action: 'confirm', email: p.email }); setMsg(`${p.name || p.email} is verified.`); load(); } catch (e) { setMsg(e.message); } };
  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'People' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">People</h1><p className="lede">{counts.all} account{counts.all === 1 ? '' : 's'}{counts.new ? ` · ${counts.new} not on an artist yet` : ''}</p></div>
        <div className="pplbar">
          <input type="search" placeholder="Search names, emails, artists" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
          <div className="pplfilters" role="group" aria-label="Show">
            {[['all', 'Everyone'], ['new', 'Not on an artist'], ['teams', 'On a team'], ['unverified', 'Not verified'], ['engineers', 'Engineers']].map(([k, l]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        {err && <p className="ferr">{err}</p>}
        {msg && <p className="toast-inline">{msg}</p>}
        {list === null ? <p className="muted">Loading…</p> : (
          <ul className="ppl">
            {shown.map((p) => (
              <li key={p.email} className="pplrow">
                <span className="pplav">{p.photo ? <img src={p.photo} alt="" /> : (p.name || p.email)[0].toUpperCase()}</span>
                <span className="pplmain">
                  <b>{p.name || p.email.replace(/@.*/, '')}{p.state === 'verified' && <BlueCheck title="Verified" />}{p.engineer && <em className="pplrole">Engineer</em>}</b>
                  <small>{p.email}</small>
                  <span className="pplmeta">
                    {p.artists.length ? p.artists.map((a) => <span key={a.artist} className="pplchip">{a.artist}<i>{a.role}</i></span>) : <span className="pplnone">{p.artistHint ? `Signed up as “${p.artistHint}”` : 'Not on an artist yet'}</span>}
                    <span className="pplwhen">Joined {ago(p.joined)}{p.last ? ` · last in ${ago(p.last)}` : ''}</span>
                  </span>
                </span>
                {!p.engineer && (
                  <span className="pplacts">
                    {p.state !== 'verified' && <button className="btn small" onClick={() => verify(p)}>Verify</button>}
                    <select defaultValue="" onChange={(e) => { add(p, e.target.value); e.target.value = ''; }} aria-label={`Add ${p.email} to an artist`}>
                      <option value="" disabled>Add to artist…</option>
                      {artists.filter((a) => !p.artists.some((x) => x.artist.toLowerCase() === a.toLowerCase())).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </span>
                )}
              </li>
            ))}
            {!shown.length && <li className="emptyday">No one matches.</li>}
          </ul>
        )}
      </section>
    </>
  );
}

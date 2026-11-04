'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import { BlueCheck } from '@/components/Credit';
import { useArtists } from '@/components/TitleCase';
import { ago } from '@/lib/format';
import { roleForTitle } from '@/lib/titles';

/** Engineer: everyone who has a CTRL ROOM account, who they're with, and quick ways to add them to an artist. */
export default function PeoplePage() {
  const { eng, session } = useApp();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');
  const artists = useArtists();
  const [reach, setReach] = useState(null); // people with an email in CTRL ROOM but no account
  const [reaching, setReaching] = useState(false);
  const loadReach = () => api('/api/people', { action: 'reach' }).then((r) => setReach(r.list || [])).catch(() => setReach([]));
  const sendReach = async () => {
    if (!reach?.length || !window.confirm(`Email ${reach.length} ${reach.length === 1 ? 'person' : 'people'} an invite to make their CTRL ROOM account?`)) return;
    setReaching(true); setMsg('Sending…');
    try {
      const r = await api('/api/people', { action: 'reach', send: true });
      setMsg(`Sent ${r.sent} invite${r.sent === 1 ? '' : 's'}.${r.failed?.length ? ` ${r.failed.length} didn’t go out: ${r.failed.slice(0, 3).map((f) => `${f.email} (${f.reason})`).join(', ')}.` : ''}${r.more ? ` ${r.more} more left, press it again.` : ''}`);
      loadReach();
    } catch (e) { setMsg(e.message); }
    setReaching(false);
  };
  const load = () => api('/api/people', { action: 'list' }).then((r) => setList(r.people || [])).catch((e) => { setErr(e.message); setList([]); });
  useEffect(() => { if (session && eng) { load(); loadReach(); } }, [session, eng]); // eslint-disable-line
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
    const role = roleForTitle(p.title);
    try { await api('/api/people', { action: 'add', email: p.email, artist, role }); setMsg(`${p.name || p.email} is now on ${artist}’s team as ${role}.`); load(); } catch (e) { setMsg(e.message); }
  };
  const removeFrom = async (p, a) => {
    if (!window.confirm(`Take ${p.name || p.email} off ${a.artist}’s team?`)) return;
    try { await api('/api/people', { action: 'remove', email: p.email, artist: a.artist }); setMsg(`${p.name || p.email} is off ${a.artist}’s team.`); load(); } catch (e) { setMsg(e.message); }
  };
  const del = async (p) => {
    if (!window.confirm(`Delete ${p.name || p.email}’s account for good? They’re taken off every team and can’t sign in. Projects and files stay.`)) return;
    try { await api('/api/people', { action: 'delete', email: p.email }); setMsg(`Deleted ${p.name || p.email}’s account.`); load(); } catch (e) { setMsg(e.message); }
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
        {reach && reach.length > 0 && (
          <div className="panel pplreach">
            <span><b>{reach.length} {reach.length === 1 ? 'person has' : 'people have'} an email here but no account</b>
              <small className="muted">Artist team members and project contacts get an invite straight into their projects. People who only sent files get a “make your account” email. Everyone also gets a reminder a day after they send files.</small>
              <details><summary className="small">See who</summary><ul className="small pplreachlist">{reach.map((x) => <li key={x.email}>{x.name ? `${x.name} · ` : ''}{x.email}{x.artist ? <span className="muted"> · {x.artist}</span> : null}<span className="muted"> · {x.kind === 'team' ? 'team invite' : 'sent files'}</span></li>)}</ul></details></span>
            <button className="btn small primary" disabled={reaching} onClick={sendReach}>{reaching ? 'Sending…' : 'Invite them all'}</button>
          </div>
        )}
        {err && <p className="ferr">{err}</p>}
        {msg && <p className="toast-inline">{msg}</p>}
        {list === null ? <p className="muted">Loading…</p> : (
          <ul className="ppl">
            {shown.map((p) => (
              <li key={p.email} className="pplrow">
                <span className="pplav">{p.photo ? <img src={p.photo} alt="" /> : (p.name || p.email)[0].toUpperCase()}</span>
                <span className="pplmain">
                  <b>{p.name || p.email.replace(/@.*/, '')}{p.state === 'verified' && <BlueCheck kind={p.engineer ? 'engineer' : p.artists.some((a) => /^artist$/i.test(a.role)) ? 'artist' : 'user'} />}{p.engineer ? <em className="pplrole">Engineer</em> : p.title ? <em className="pplrole">{p.title}</em> : null}</b>
                  <small>{p.email}</small>
                  <span className="pplmeta">
                    {p.artists.length ? p.artists.map((a) => <span key={a.artist} className="pplchip">{a.artist}<i>{a.role}</i>{!p.engineer && <button type="button" className="pplx" onClick={() => removeFrom(p, a)} aria-label={`Remove ${p.name || p.email} from ${a.artist}`} title={`Remove from ${a.artist}`}>×</button>}</span>) : <span className="pplnone">{p.artistHint ? `Signed up as “${p.artistHint}”` : 'Not on an artist yet'}</span>}
                    <span className="pplwhen">Joined {ago(p.joined)}{p.last ? ` · last in ${ago(p.last)}` : ''}</span>
                  </span>
                </span>
                {!p.engineer && (
                  <span className="pplacts">
                    {p.state !== 'verified' && <button className="btn small" onClick={() => verify(p)}>Verify</button>}
                    {(() => { const match = p.artistHint && artists.find((a) => a.toLowerCase() === p.artistHint.toLowerCase()); return match && !p.artists.some((x) => x.artist.toLowerCase() === match.toLowerCase())
                      ? <button className="btn small primary" onClick={() => add(p, match)} title={`Add to ${match} as ${roleForTitle(p.title)}`}>Add to {match}</button> : null; })()}
                    <select defaultValue="" onChange={(e) => { add(p, e.target.value); e.target.value = ''; }} aria-label={`Add ${p.email} to an artist`}>
                      <option value="" disabled>Add to artist…</option>
                      {artists.filter((a) => !p.artists.some((x) => x.artist.toLowerCase() === a.toLowerCase())).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <button className="pplrm" onClick={() => del(p)} aria-label={`Delete ${p.email}’s account`} title="Delete account"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>
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

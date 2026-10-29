'use client';
import { selectWithVersions } from '@/lib/embed';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { hashStr, artOf } from '@/lib/art';
import { fmtDate, todayISO, statusText, shortDate } from '@/lib/format';
import { ArtistHero, ArtistAvatar } from '@/components/ArtistProfile';
import ArtistTeam from '@/components/ArtistTeam';
import AddArtist from '@/components/AddArtist';
import { BlueCheck } from '@/components/Credit';

const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const sortKey = (n) => n.replace(/^the\s+/i, '');

function Artists() {
  const { eng, session } = useApp();
  const router = useRouter();
  const sel = useSearchParams().get('a');
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');
  const [profiles, setProfiles] = useState({});
  const [adding, setAdding] = useState(false);
  const [ver, setVer] = useState({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    selectWithVersions((V) => supabase().from('projects').select(`*, songs(*, ${V}(id,label,created_at))`).order('created_at', { ascending: false })).then(({ data }) => setProjects(data || []));
    supabase().from('artists').select('*').then(({ data }) => setProfiles(Object.fromEntries((data || []).map((a) => [a.name.toLowerCase(), a]))));
    if (eng) api('/api/verify', { action: 'artists' }).then((r) => setVer(r.artists || {})).catch(() => {});
  }, [session, eng, tick]);
  const prof = (n) => profiles[n.toLowerCase()];
  const setProf = (a) => setProfiles((m) => ({ ...m, [a.name.toLowerCase()]: a }));

  const artists = useMemo(() => {
    const m = new Map();
    const keep = new Set([...(projects || []).filter((p) => !p.archived).map((p) => p.artist.toLowerCase()), ...Object.keys(profiles)]);
    (projects || []).forEach((p) => {
      if (!keep.has(p.artist.toLowerCase())) return; // only archived projects and no artist page (e.g. a deleted artist)
      if (!m.has(p.artist)) m.set(p.artist, { name: p.artist, projects: [], contact: p.contact_name, phone: p.phone, email: p.client_email });
      const a = m.get(p.artist);
      a.projects.push(p);
      a.contact ||= p.contact_name; a.phone ||= p.phone; a.email ||= p.client_email;
    });
    // artists added by hand (no project yet) show too
    Object.values(profiles).forEach((a) => { if (![...m.keys()].some((k) => k.toLowerCase() === a.name.toLowerCase())) m.set(a.name, { name: a.name, projects: [] }); });
    return [...m.values()].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
  }, [projects, profiles]);

  if (!session) return null;
  if (!projects) return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Artists' }]} /><section className="page"><p className="muted">Loading…</p></section></>;

  const today = todayISO();
  const stats = (a) => {
    const songs = a.projects.flatMap((p) => (p.songs || []).map((s) => ({ p, s })));
    const live = songs.filter((x) => x.s.status !== 'approved'), done = songs.filter((x) => x.s.status === 'approved');
    const next = live.filter((x) => x.s.eta).sort((x, y) => x.s.eta.localeCompare(y.s.eta))[0];
    return { songs, live, done, next };
  };

  // clients with a single artist go straight to that artist's page
  const artist = (sel && artists.find((a) => a.name === sel)) || (!eng && artists.length === 1 ? artists[0] : null);
  if (artist) {
    const st = stats(artist);
    return (
      <>
        <TopBar crumbs={[{ label: 'Home', href: '/' }, ...(eng || artists.length > 1 ? [{ label: 'Artists', href: '/artists' }] : []), { label: prof(artist.name)?.display_name || artist.name }]} />
        <section className="page"><div className="adetail">
          {(eng || artists.length > 1) && <button className="aback" onClick={() => router.push('/artists')}>‹ All artists</button>}
          <ArtistHero name={artist.name} profile={prof(artist.name)} canEdit onChange={setProf}>
            {eng && ver[artist.name.toLowerCase()] && <div className="acontact"><span className={`vbadge ${ver[artist.name.toLowerCase()].verified ? '' : 'pending'}`}>{ver[artist.name.toLowerCase()].verified ? <><BlueCheck />Verified</> : 'Not verified yet'}</span></div>}
            {eng && (artist.contact || artist.phone || artist.email) && <div className="acontact">
              {artist.contact && <span className="sichip">Contact <b>{artist.contact}</b></span>}
              {artist.phone && <span className="sichip mono">{artist.phone}</span>}
              {artist.email && <span className="sichip">{artist.email}</span>}
            </div>}
          </ArtistHero>
          <div className="astats">
            <div className="astat"><b>{artist.projects.length}</b><span>Projects</span></div>
            <div className="astat"><b>{st.songs.length}</b><span>Songs</span></div>
            <div className="astat"><b>{st.live.length}</b><span>In progress</span></div>
            <div className="astat"><b>{st.done.length}</b><span>Approved</span></div>
          </div>
          <section className="asec"><h2 className="h2 up">Working on</h2><div className="duelist">
            {st.live.length ? [...st.live].sort((x, y) => (x.s.eta || '9').localeCompare(y.s.eta || '9')).map(({ p, s }) => (
              <Link key={s.id} className="due" href={`/s/${s.id}`}><Cover {...artOf(s, p)} size={120} />
                <span className="dt"><b className="ttl">{s.title}</b><span>{p.title}</span></span>
                <span className="dw"><span className={`dot ${s.status}`}>{statusText(s, s.versions)}</span><span className="dsub">{s.eta ? `Due ${s.eta === today ? 'today' : fmtDate(s.eta)}` : 'No due date'}</span></span>
                <span className="chev" aria-hidden="true">›</span></Link>
            )) : <p className="emptyday">Nothing in progress. Every song is signed off.</p>}
          </div></section>
          <section className="asec"><h2 className="h2 up">Projects</h2><div className="shelf">
            {artist.projects.map((p) => { const n = p.songs?.length || 0, ap = (p.songs || []).filter((s) => s.status === 'approved').length;
              return <Link key={p.id} className="pcard" href={`/p/${p.id}`}><span className="pc-art"><span className="pc-rec" /><Cover seed={p.seed} path={p.cover_path} size={360} /></span>
                <b className="ttl">{p.title}</b><span className="pc-sub">{(p.songs || []).length} song{(p.songs || []).length === 1 ? '' : 's'}{p.release ? ` · out ${fmtDate(p.release)}` : ''}</span>
                <span className="pc-bar"><i style={{ width: `${n ? (ap / n) * 100 : 0}%` }} /></span><span className="pc-sub">{ap} of {n} approved</span></Link>; })}
          </div></section>
          {eng && <ArtistTeam artist={artist.name} projects={artist.projects} />}
          {eng && <DeleteArtist name={artist.name} count={artist.projects.length} onDone={() => { setTick((t) => t + 1); router.push('/artists'); }} />}
          {st.done.length > 0 && <section className="asec"><h2 className="h2 up">Finished</h2><ul className="mlist">
            {st.done.map(({ p, s }) => <li key={s.id}><Link className="mini-row" href={`/s/${s.id}`}><Cover {...artOf(s, p)} size={80} /><span><b>{s.title}</b><small>{p.title} · approved {shortDate(s.approved_at)}</small></span></Link></li>)}
          </ul></section>}
        </div></section>
      </>
    );
  }

  const shown = artists.filter((a) => !q.trim() || a.name.toLowerCase().includes(q.toLowerCase()) || (a.contact || '').toLowerCase().includes(q.toLowerCase()));
  const groups = {};
  shown.forEach((a) => { const L = (sortKey(a.name)[0] || '#').toUpperCase(); (groups[L] ||= []).push(a); });
  const live = artists.reduce((n, a) => n + stats(a).live.length, 0);

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Artists' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">Artists</h1><p className="lede">{artists.length} artist{artists.length === 1 ? '' : 's'} · {live} song{live === 1 ? '' : 's'} in progress</p>
          {eng && <button className="btn primary small" onClick={() => setAdding(!adding)} aria-expanded={adding}>{adding ? 'Close' : '+ Add artist'}</button>}</div>
        {eng && adding && <AddArtist onDone={() => setTick((t) => t + 1)} />}
        <div className="asearch"><input type="search" placeholder="Search artists" aria-label="Search artists" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="aletters">{Object.keys(groups).map((L) => <button key={L} onClick={() => document.getElementById(`ag-${L}`)?.scrollIntoView({ behavior: 'smooth' })}>{L}</button>)}</div>
        <div className="arows">
          {Object.entries(groups).map(([L, as]) => (
            <div key={L}>
              <div className="agroup" id={`ag-${L}`}>{L}</div>
              {as.map((a) => { const st = stats(a);
                const pill = st.next ? `Due ${st.next.s.eta === today ? 'today' : fmtDate(st.next.s.eta)}` : st.live.length ? `${st.live.length} in progress` : 'All approved';
                return (
                  <Link key={a.name} className="arow" href={`/artists?a=${encodeURIComponent(a.name)}`}>
                    <ArtistAvatar name={a.name} profile={prof(a.name)} />
                    <span style={{ minWidth: 0 }}>
                      <b className="aname"><span>{prof(a.name)?.display_name || a.name}</span>{eng && ver[a.name.toLowerCase()]?.verified > 0 && <BlueCheck title={`Verified · ${ver[a.name.toLowerCase()].verified} of ${ver[a.name.toLowerCase()].total} people`} />}</b>
                      <small>{a.projects.length ? `${a.projects.length} project${a.projects.length > 1 ? 's' : ''}` : 'No projects yet'} · {st.songs.length} song{st.songs.length === 1 ? '' : 's'}{eng && ver[a.name.toLowerCase()] && !ver[a.name.toLowerCase()].verified ? ` · ${ver[a.name.toLowerCase()].joined ? 'not confirmed' : 'not joined yet'}` : ''}</small>
                    </span>
                    <span className="apill" style={st.live.length ? undefined : { color: 'var(--ok)' }}>{pill}</span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                ); })}
            </div>
          ))}
          {!shown.length && <p className="emptyday">{artists.length ? `No artists match “${q}”.` : 'Artists show up here as you create projects.'}</p>}
        </div>
      </section>
    </>
  );
}

function DeleteArtist({ name, count, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (projects) => {
    if (projects === 'delete' && !window.confirm(`Delete ${name} and all ${count} of their project${count === 1 ? '' : 's'}? Every song, mix, note and file goes too. This can’t be undone.`)) return;
    setBusy(true); setErr('');
    try { await api('/api/artists/delete', { artist: name, projects }); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <section className="asec adelete">
      {!open ? <button className="btn small quiet danger" onClick={() => setOpen(true)}>Delete artist</button> : (
        <div className="panel">
          <h3>Delete {name}?</h3>
          <p className="muted small" style={{ margin: 0 }}>Removes their artist page and team, so nobody on it can get in anymore.{count ? ` They have ${count} project${count === 1 ? '' : 's'}.` : ''}</p>
          <div className="row-actions">
            <button className="btn small quiet" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            {count > 0 && <button className="btn small" onClick={() => go('archive')} disabled={busy}>Delete artist, archive projects</button>}
            <button className="btn small danger" onClick={() => go(count ? 'delete' : 'archive')} disabled={busy}>{busy ? 'Deleting…' : count ? 'Delete artist and projects' : 'Delete artist'}</button>
          </div>
          {err && <p className="ferr" style={{ margin: 0 }}>{err}</p>}
        </div>
      )}
    </section>
  );
}

export default function ArtistsPage() {
  return <Suspense fallback={null}><Artists /></Suspense>;
}

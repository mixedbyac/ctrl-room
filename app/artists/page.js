'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { hashStr } from '@/lib/art';
import { fmtDate, todayISO, statusText, shortDate } from '@/lib/format';

const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const sortKey = (n) => n.replace(/^the\s+/i, '');

function Artists() {
  const { eng, session } = useApp();
  const router = useRouter();
  const sel = useSearchParams().get('a');
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!eng) return;
    supabase().from('projects').select('*, songs(*, versions(id,label,created_at))').order('created_at', { ascending: false }).then(({ data }) => setProjects(data || []));
  }, [eng]);

  const artists = useMemo(() => {
    const m = new Map();
    (projects || []).forEach((p) => {
      if (!m.has(p.artist)) m.set(p.artist, { name: p.artist, projects: [], contact: p.contact_name, phone: p.phone, email: p.client_email });
      const a = m.get(p.artist);
      a.projects.push(p);
      a.contact ||= p.contact_name; a.phone ||= p.phone; a.email ||= p.client_email;
    });
    return [...m.values()].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
  }, [projects]);

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Artists' }]} /><section className="page"><p className="muted">This page is for your engineer.</p></section></>;
  if (!projects) return <><TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Artists' }]} /><section className="page"><p className="muted">Loading…</p></section></>;

  const today = todayISO();
  const stats = (a) => {
    const songs = a.projects.flatMap((p) => (p.songs || []).map((s) => ({ p, s })));
    const live = songs.filter((x) => x.s.status !== 'approved'), done = songs.filter((x) => x.s.status === 'approved');
    const next = live.filter((x) => x.s.eta).sort((x, y) => x.s.eta.localeCompare(y.s.eta))[0];
    return { songs, live, done, next };
  };

  const artist = sel && artists.find((a) => a.name === sel);
  if (artist) {
    const st = stats(artist);
    return (
      <>
        <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Artists', href: '/artists' }, { label: artist.name }]} />
        <section className="page"><div className="adetail">
          <button className="aback" onClick={() => router.push('/artists')}>‹ All artists</button>
          <div className="ahero">
            <Cover as="div" seed={hashStr(artist.name)} size={360} className="avatar">{initials(artist.name)}</Cover>
            <div><p className="eyebrow">Artist</p><h1 className="up">{artist.name}</h1>
              <div className="acontact">
                {artist.contact && <span className="sichip">Contact <b>{artist.contact}</b></span>}
                {artist.phone && <span className="sichip mono">{artist.phone}</span>}
                {artist.email && <span className="sichip">{artist.email}</span>}
              </div></div>
          </div>
          <div className="astats">
            <div className="astat"><b>{artist.projects.length}</b><span>Projects</span></div>
            <div className="astat"><b>{st.songs.length}</b><span>Songs</span></div>
            <div className="astat"><b>{st.live.length}</b><span>In progress</span></div>
            <div className="astat"><b>{st.done.length}</b><span>Approved</span></div>
          </div>
          <section className="asec"><h2 className="h2 up">Working on</h2><div className="duelist">
            {st.live.length ? [...st.live].sort((x, y) => (x.s.eta || '9').localeCompare(y.s.eta || '9')).map(({ p, s }) => (
              <Link key={s.id} className="due" href={`/s/${s.id}`}><Cover seed={s.seed} size={120} />
                <span className="dt"><b className="up">{s.title}</b><span>{p.title} · {p.type}</span></span>
                <span className="dw"><span className={`dot ${s.status}`}>{statusText(s, s.versions)}</span><span className="dsub">{s.eta ? `Due ${s.eta === today ? 'today' : fmtDate(s.eta)}` : 'No due date'}</span></span>
                <span className="chev" aria-hidden="true">›</span></Link>
            )) : <p className="emptyday">Nothing in progress. Every song is signed off.</p>}
          </div></section>
          <section className="asec"><h2 className="h2 up">Projects</h2><div className="shelf">
            {artist.projects.map((p) => { const n = p.songs?.length || 0, ap = (p.songs || []).filter((s) => s.status === 'approved').length;
              return <Link key={p.id} className="pcard" href={`/p/${p.id}`}><span className="pc-art"><span className="pc-rec" /><Cover seed={p.seed} size={360} /></span>
                <b className="up">{p.title}</b><span className="pc-sub">{p.type}{p.release ? ` · out ${fmtDate(p.release)}` : ''}</span>
                <span className="pc-bar"><i style={{ width: `${n ? (ap / n) * 100 : 0}%` }} /></span><span className="pc-sub">{ap} of {n} approved</span></Link>; })}
          </div></section>
          {st.done.length > 0 && <section className="asec"><h2 className="h2 up">Finished</h2><ul className="mlist">
            {st.done.map(({ p, s }) => <li key={s.id}><Link className="mini-row" href={`/s/${s.id}`}><Cover seed={s.seed} size={80} /><span><b>{s.title}</b><small>{p.title} · approved {shortDate(s.approved_at)}</small></span></Link></li>)}
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
        <div className="hhead"><h1 className="up">Artists</h1><p className="lede">{artists.length} artist{artists.length === 1 ? '' : 's'} · {live} song{live === 1 ? '' : 's'} in progress</p></div>
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
                    <Cover as="div" seed={hashStr(a.name)} size={120} className="avatar">{initials(a.name)}</Cover>
                    <span style={{ minWidth: 0 }}><b>{a.name}</b><small>{a.projects.length} project{a.projects.length > 1 ? 's' : ''} · {st.songs.length} song{st.songs.length === 1 ? '' : 's'}{a.contact && a.contact !== a.name ? ` · ${a.contact}` : ''}</small></span>
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

export default function ArtistsPage() {
  return <Suspense fallback={null}><Artists /></Suspense>;
}

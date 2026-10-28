'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import { findLeaks, isShareSource, placeOf, deviceOf } from '@/lib/leaks';
import { mmss, ago } from '@/lib/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const initials = (s) => String(s || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const when = (iso) => {
  const d = new Date(iso), days = (Date.now() - d.getTime()) / 86400000;
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', ' ');
  return `${days < 1 && d.getDate() === new Date().getDate() ? 'Today' : days < 6 ? DAYS[d.getDay()] : d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${t}`;
};

export default function Insights() {
  const { eng, session } = useApp();
  const [plays, setPlays] = useState(null);
  const [project, setProject] = useState('all');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem('ctrl-room:alerts-done') || '[]'); } catch { return []; } });

  useEffect(() => {
    if (!eng) return;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    supabase().from('plays').select('*, songs(id,title,project_id,projects(id,title,artist)), versions(label)').gte('started_at', since).order('started_at', { ascending: false }).limit(3000)
      .then(({ data }) => setPlays(data || []));
  }, [eng]);

  const projects = useMemo(() => {
    const m = new Map();
    (plays || []).forEach((p) => { const pr = p.songs?.projects; if (pr) m.set(pr.id, pr); });
    return [...m.values()];
  }, [plays]);
  const alerts = useMemo(() => findLeaks(plays || []).filter((a) => !done.includes(a.key)), [plays, done]);

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Insights' }]} /><section className="page"><p className="muted">This page is for your engineer.</p></section></>;

  const week = (plays || []).filter((p) => Date.now() - new Date(p.started_at).getTime() < 7 * 86400000 && (project === 'all' || p.songs?.project_id === project));
  const bySong = new Map();
  week.forEach((p) => { const k = p.song_id; bySong.set(k, { title: p.songs?.title || 'Song', id: k, n: (bySong.get(k)?.n || 0) + 1 }); });
  const bars = [...bySong.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  const top = bars[0]?.n || 1;
  const latest = (plays || [])[0];
  const listeners = new Set(week.map((p) => p.listener_email || `${deviceOf(p.device)}|${placeOf(p.device)}`)).size;
  const minutes = Math.round(week.reduce((n, p) => n + (p.listened || 0), 0) / 60);
  const shareShare = week.length ? Math.round((week.filter((p) => isShareSource(p.source)).length / week.length) * 100) : 0;

  const dismiss = (a) => { const next = [...done, a.key].slice(-300); setDone(next); try { localStorage.setItem('ctrl-room:alerts-done', JSON.stringify(next)); } catch {} };
  const act = async (a, action) => {
    setMsg('');
    try {
      const id = a.linkKind === 'project' ? a.projectId : a.songId;
      if (action === 'off') await api('/api/share', { kind: a.linkKind, id, action: 'set', on: false });
      else await api('/api/share', { kind: a.linkKind, id, action: 'reset' });
      setMsg(action === 'off' ? `Sharing is off for ${a.linkKind === 'project' ? a.project : a.title}. That link no longer plays.` : `Made a new link for ${a.linkKind === 'project' ? a.project : a.title}. The old one stopped working. Send the new one only to people you trust.`);
      dismiss(a);
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Insights' }]} />
      <section className="page insights">
        <div className="hhead"><h1 className="up">Insights</h1><p className="lede">Who’s listening, and anything that looks off.</p></div>
        {msg && <p className="toast-inline" style={{ marginBottom: 14 }}>{msg}</p>}

        <div className="ins-row">
          <div className="ins-copy">
            <h2 className="ins-h up">Watching your links</h2>
            <p>Every share link is checked for signs of a leak: a sudden run of plays, a listen from somewhere nobody on the project has played from, or one link spreading across too many devices. If it happens, you get a text right away and it shows here, so you can shut the link down.</p>
          </div>
          <div className="ins-card">
            {plays === null ? <p className="muted small">Loading…</p> : alerts.length ? alerts.slice(0, 4).map((a) => (
              <div key={a.key} className="ins-alert">
                <div className="ins-head"><span className="ins-bang">!</span><div><b>Unusual activity on {a.title}</b><span>{a.project ? `${a.project} · ` : ''}{when(new Date(a.at).toISOString())}</span></div></div>
                <p>{a.text}</p>
                <div className="row-actions">
                  <button className="btn small danger" onClick={() => act(a, 'off')}>Shut down link</button>
                  <button className="btn small dangerq" onClick={() => act(a, 'reset')}>Reset link</button>
                  <button className="btn small quiet" onClick={() => dismiss(a)}>It’s fine</button>
                </div>
              </div>
            )) : (
              <div className="ins-ok"><span className="ins-check">✓</span><div><b>All quiet</b><span>Nothing unusual on your share links in the last two weeks.</span></div></div>
            )}
          </div>
        </div>

        <div className="ins-row">
          <div className="ins-copy">
            <h2 className="ins-h up">Know when they listen</h2>
            <p>See which client played which mix, how long they stayed, and how often. It’s only about your mixes, never about tracking people around the web.</p>
            <div className="ins-stats">
              <div><b>{week.length}</b><span>plays this week</span></div>
              <div><b>{listeners}</b><span>listeners</span></div>
              <div><b>{minutes}</b><span>minutes heard</span></div>
              <div><b>{shareShare}%</b><span>from share links</span></div>
            </div>
          </div>
          <div className="ins-card">
            {latest ? (
              <Link className="ins-latest" href={`/s/${latest.song_id}`}>
                <span className="ins-av">{initials(latest.listener_email || (isShareSource(latest.source) ? 'Share link' : 'Client'))}</span>
                <div><b>{latest.listener_email ? latest.listener_email.replace(/@.*/, '') : isShareSource(latest.source) ? 'Someone with a share link' : 'Your client'} listened to {latest.songs?.title}</b>
                  <span>{[when(latest.started_at), latest.versions?.label, latest.listened ? `${mmss(latest.listened)} heard` : '', placeOf(latest.device)].filter(Boolean).join(' · ')}</span></div>
              </Link>
            ) : <p className="muted small">No listens yet. Send a mix and they’ll show up here.</p>}
            <div className="ins-barhead"><b>Plays this week</b>
              <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select></div>
            {bars.length ? (
              <ul className="ins-bars">
                {bars.map((b) => (
                  <li key={b.id}><Link href={`/s/${b.id}`}>{b.title}</Link><span className="ins-track"><i style={{ width: `${Math.max(4, (b.n / top) * 100)}%`, opacity: 0.45 + 0.55 * (b.n / top) }} /></span><b className="mono">{b.n}</b></li>
                ))}
              </ul>
            ) : <p className="muted small" style={{ margin: 0 }}>No plays in the last 7 days{project !== 'all' ? ' on this project' : ''}.</p>}
          </div>
        </div>

        <div className="ins-rules">
          <h2 className="ins-h up">Your rules</h2>
          <div className="ins-rule"><b>Every link is yours to control</b><span>Turn sharing off for a song or a whole project, or reset a link so the old one stops working. Do it from the Share button or right here when something looks off.</span></div>
          <div className="ins-rule"><b>Nothing gets passed around</b><span>Notes, versions and your client list stay private. Share links only ever play the current mix.</span></div>
          <div className="ins-rule"><b>See everything</b><span>Every play, device, place and time on every link, for you to look at any time. <Link className="link" href="/protect">How CTRL ROOM protects your music</Link></span></div>
        </div>
      </section>
    </>
  );
}

'use client';
import { TitleInput, ArtistPicker } from '@/components/TitleCase';
import { selectWithVersions } from '@/lib/embed';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { artOf } from '@/lib/art';
import QuickDrop from '@/components/QuickDrop';
import { fmtDate, todayISO, addDaysISO, statusText, ago, mmss, fmtBytes, latestMix, mixesOf, nextLabel } from '@/lib/format';

export default function HomePage() {
  const { eng, session } = useApp();
  if (!session) return null;
  return eng ? <EngineerHome /> : <ClientHome />;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function EngineerHome() {
  const router = useRouter();
  const { reloadProjects } = useApp();
  const [projects, setProjects] = useState(null);
  const [activity, setActivity] = useState([]);
  const [fresh, setFresh] = useState(0);
  const [day, setDay] = useState(todayISO());
  const [showNew, setShowNew] = useState(false);
  useEffect(() => {
    const go = () => { setShowNew(true); setTimeout(() => document.querySelector('#np-t')?.focus(), 80); };
    if (/[?&]new=1/.test(window.location.search)) { go(); window.history.replaceState(null, '', '/'); }
    window.addEventListener('ctrl-room:new-project', go);
    return () => window.removeEventListener('ctrl-room:new-project', go);
  }, []);

  const loadProjects = () => selectWithVersions((V) => supabase().from('projects').select(`*, songs(*, ${V}(id,label,created_at))`).eq('archived', false).order('created_at', { ascending: false }))
    .then(({ data }) => setProjects(data || []));
  useEffect(() => {
    const sb = supabase();
    loadProjects();
    Promise.all([
      sb.from('plays').select('*, songs(title,seed,cover_path,project_id,projects(seed,cover_path)), versions(label)').order('updated_at', { ascending: false }).limit(15),
      sb.from('notes').select('*, songs(title,seed,cover_path,projects(seed,cover_path)), versions(label)').eq('from_client', true).order('created_at', { ascending: false }).limit(15),
      sb.from('updates').select('*, songs(title,seed,cover_path,projects(seed,cover_path))').eq('from_client', true).order('created_at', { ascending: false }).limit(15),
      sb.from('uploads').select('id', { count: 'exact', head: true }).is('downloaded_at', null),
    ]).then(([pl, no, up, fr]) => {
      const items = [
        ...(pl.data || []).map((x) => ({ kind: 'play', at: x.updated_at, x })),
        ...(no.data || []).map((x) => ({ kind: 'note', at: x.created_at, x })),
        ...(up.data || []).map((x) => ({ kind: 'update', at: x.created_at, x })),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
      setActivity(items);
      setFresh(fr.count || 0);
    });
  }, []);

  const songs = useMemo(() => (projects || []).flatMap((p) => (p.songs || []).map((s) => ({ p, s }))), [projects]);
  const today = todayISO();
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i));
  const dueOn = (d) => songs.filter(({ s }) => s.eta === d && s.status !== 'approved');
  const overdue = songs.filter(({ s }) => s.eta && s.eta < today && s.status !== 'approved');
  const waiting = songs.filter(({ s }) => s.status === 'review');
  const list = day === today ? [...overdue, ...dueOn(day)] : dueOn(day);

  if (!projects) return <><TopBar crumbs={[{ label: 'Home' }]} /><section className="page"><p className="muted">Loading…</p></section></>;

  return (
    <>
      <TopBar crumbs={[{ label: 'Home' }]} />
      <section className="page">
        <div className="hhead">
          <p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="up">{greeting()}</h1>
          <p className="lede">
            {[dueOn(today).length ? `${dueOn(today).length} mix${dueOn(today).length > 1 ? 'es' : ''} due today` : 'Nothing due today',
              overdue.length ? `${overdue.length} overdue` : '', waiting.length ? `${waiting.length} waiting on clients` : '',
              fresh ? `${fresh} new in the Portal` : ''].filter(Boolean).join(' · ')}.
          </p>
        </div>

        <QuickDrop projects={projects} onDone={() => { loadProjects(); reloadProjects(); }} />

        <div className="week" role="group" aria-label="This week">
          {week.map((d) => {
            const n = dueOn(d).length + (d === today ? overdue.length : 0);
            const dt = new Date(d + 'T12:00:00');
            return (
              <button key={d} className={`day ${d === today ? 'today' : ''}`} aria-pressed={d === day} onClick={() => setDay(d)}>
                <span className="wd">{d === today ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="dn mono">{dt.getDate()}</span>
                <span className="dots">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
              </button>
            );
          })}
        </div>

        <section className="hsec">
          <h2 className="h2 up">{day === today ? 'Due today' : `Due ${fmtDate(day)}`}</h2>
          <div className="duelist">
            {list.length ? list.map(({ p, s }) => (
              <Link key={s.id} className="due" href={`/s/${s.id}`}>
                <Cover {...artOf(s, p)} size={120} />
                <span className="dt"><b className="ttl">{s.title}</b><span>{p.title} · {p.artist}</span></span>
                <span className="dw">
                  <span className={`dot ${s.status}`}>{s.eta < today ? `Overdue · ${fmtDate(s.eta)}` : mixesOf(s.versions).length ? nextLabel(s.versions) : 'First mix'}</span>
                  <span className="dsub">{statusText(s, s.versions)}</span>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            )) : <p className="emptyday">Nothing due {day === today ? 'today' : 'on this day'}.</p>}
          </div>
        </section>

        <section className="hsec">
          <div className="boxhead"><h2 className="h2 up">Your projects</h2><button className="btn small" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : '+ New project'}</button></div>
          {showNew && <NewProject onDone={async (id) => { await reloadProjects(); router.push(`/p/${id}`); }} />}
          {projects.length ? (
            <div className="shelf">
              {projects.map((p) => {
                const n = p.songs?.length || 0, ap = (p.songs || []).filter((s) => s.status === 'approved').length;
                const next = (p.songs || []).filter((s) => s.eta && s.status !== 'approved').map((s) => s.eta).sort()[0];
                return (
                  <Link key={p.id} className="pcard" href={`/p/${p.id}`}>
                    <span className="pc-art"><span className="pc-rec" /><Cover seed={p.seed} path={p.cover_path} size={360} /></span>
                    <b className="ttl">{p.title}</b>
                    <span className="pc-sub">{p.artist} · {p.type}</span>
                    <span className="pc-bar"><i style={{ width: `${n ? (ap / n) * 100 : 0}%` }} /></span>
                    <span className="pc-sub">{ap} of {n} approved{next ? ` · next due ${next === today ? 'today' : fmtDate(next)}` : ''}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><strong>No projects yet</strong>Start one here, or send a client your Portal link and they'll set it up for you.</div>
          )}
        </section>

        <div className="cols hsec">
          <section>
            <h2 className="h2 up" style={{ marginBottom: 12 }}>Waiting on clients</h2>
            <ul className="mlist">
              {waiting.length ? waiting.map(({ p, s }) => {
                const last = latestMix(s.versions || []);
                return (
                  <li key={s.id}><Link className="mini-row" href={`/s/${s.id}`}><Cover {...artOf(s, p)} size={80} />
                    <span><b>{s.title}</b><small>{p.artist}{last ? ` · ${last.label} sent ${fmtDate(last.created_at)}` : ''}</small></span></Link></li>
                );
              }) : <li className="emptyday">No one owes you a listen right now.</li>}
            </ul>
          </section>
          <section>
            <UnpaidInvoices />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 12 }}><h2 className="h2 up" style={{ margin: 0 }}>Activity</h2><Link className="link small" href="/insights">Insights ›</Link></div>
            <ul className="nlist" style={{ overflow: 'visible' }}>
              {activity.length ? activity.map((a) => <ActivityItem key={a.kind + a.x.id} a={a} />) : <li className="emptyday">Plays, notes and sign-offs will show up here.</li>}
            </ul>
            {fresh > 0 && <p style={{ marginTop: 12 }}><Link className="link" href="/portal/inbox">{fresh} new send{fresh > 1 ? 's' : ''} in the Portal ›</Link></p>}
          </section>
        </div>
      </section>
    </>
  );
}

function ActivityItem({ a }) {
  const x = a.x, song = x.songs || {};
  const who = x.listener_email || x.author_name || x.author_email || (/share link/.test(x.source || '') ? 'Someone' : 'Client');
  let text, body = null, icon = '▶';
  if (a.kind === 'play') {
    const pct = x.duration ? Math.min(100, Math.round((x.listened / x.duration) * 100)) : 0;
    text = <><b>{who}</b> played <b>{song.title} {x.versions?.label || ''}</b></>;
    body = <><span className="nmeta">{x.device || 'Unknown device'}{x.source ? ` · ${x.source}` : ''}</span>
      <span className="nlisten"><span className="nbar"><i style={{ width: `${pct}%` }} /></span><span className="mono">{mmss(x.listened)} of {mmss(x.duration)} · {pct}%</span></span></>;
  } else if (a.kind === 'note') {
    icon = '✎';
    text = <><b>{who}</b> left a note on <b>{song.title} {x.versions?.label || ''}</b>{x.t != null ? <> at <span className="mono">{mmss(x.t)}</span></> : null}</>;
    body = <span className="nquote">“{x.body}”</span>;
  } else {
    icon = /approved/i.test(x.body) ? '✓' : /changes/i.test(x.body) ? '↺' : '↑';
    text = <><b>{song.title}</b>: {x.body}</>;
  }
  const kind = icon === '✓' ? 'approve' : icon === '↺' ? 'changes' : a.kind;
  return (
    <li>
      <Link className={`nitem k-${kind}`} href={`/s/${x.song_id}`}>
        <Cover as="div" {...artOf(song, song.projects)} size={84} className="nart"><i>{icon}</i></Cover>
        <span className="nmain"><span className="ntext">{text}</span>{body}<span className="nwhen">{ago(a.at)}</span></span>
      </Link>
    </li>
  );
}

function NewProject({ onDone }) {
  const [f, setF] = useState({ title: '', artist: '', type: 'Single', client_email: '', phone: '', release: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.artist.trim()) return setErr('Add a title and the artist.');
    setBusy(true);
    const { data, error } = await supabase().from('projects').insert({
      title: f.title.trim(), artist: f.artist.trim(), type: f.type, client_email: f.client_email.trim().toLowerCase() || null,
      phone: f.phone.trim() || null, release: f.release || null, seed: Math.floor(Math.random() * 1e9),
    }).select('id').single();
    setBusy(false);
    if (error) return setErr(error.message);
    onDone(data.id);
  };
  return (
    <form className="panel" onSubmit={save} style={{ marginBottom: 20 }}>
      <div className="two">
        <div className="fld"><label htmlFor="np-t">Project title</label><TitleInput id="np-t" value={f.title} onChange={(v) => setF((x) => ({ ...x, title: v }))} /></div>
        <div className="fld"><label htmlFor="np-a">Artist</label><ArtistPicker id="np-a" value={f.artist} onChange={(v) => setF((x) => ({ ...x, artist: v }))} /></div>
        <div className="fld"><label htmlFor="np-e">Client email <span className="opt">they sign in with this</span></label><input id="np-e" type="email" value={f.client_email} onChange={set('client_email')} /></div>
        <div className="fld"><label htmlFor="np-p">Client phone <span className="opt">for texts</span></label><input id="np-p" type="tel" value={f.phone} onChange={set('phone')} /></div>
        <div className="fld"><label htmlFor="np-ty">Type</label><select id="np-ty" value={f.type} onChange={set('type')}><option>Single</option><option>EP</option><option>Album</option><option>Mixtape</option></select></div>
        <div className="fld"><label htmlFor="np-r">Release date <span className="opt">optional</span></label><input id="np-r" type="date" value={f.release} onChange={set('release')} /></div>
      </div>
      {err && <p className="ferr">{err}</p>}
      <div className="row-actions"><button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button></div>
    </form>
  );
}

function ClientHome() {
  const [projects, setProjects] = useState(null);
  useEffect(() => {
    supabase().from('projects').select('*, songs(id,title,status,seed,cover_path,eta,approved_version,received_at,downloaded_at,mixing_at)').eq('archived', false).order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data || []));
  }, []);
  if (!projects) return <><TopBar crumbs={[{ label: 'Home' }]} /><section className="page"><p className="muted">Loading…</p></section></>;
  return (
    <>
      <TopBar crumbs={[{ label: 'Home' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">{greeting()}</h1><p className="lede">Your projects and every mix, all in one place.</p></div>
        {projects.length ? (
          <div className="shelf">
            {projects.map((p) => {
              const n = p.songs?.length || 0, rv = (p.songs || []).filter((s) => s.status === 'review').length;
              return (
                <Link key={p.id} className="pcard" href={`/p/${p.id}`}>
                  <span className="pc-art"><span className="pc-rec" /><Cover seed={p.seed} path={p.cover_path} size={360} /></span>
                  <b className="ttl">{p.title}</b>
                  <span className="pc-sub">{p.artist} · {n} song{n === 1 ? '' : 's'}</span>
                  <span className="pc-sub" style={{ color: rv ? 'var(--sig)' : undefined }}>{rv ? `${rv} mix${rv > 1 ? 'es' : ''} ready for you` : 'In the works'}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Nothing here yet</strong>
            Start a project and send your files through the Portal. If your engineer already set one up, make sure you signed in with the email they have for you.
            <Link className="btn primary" href="/portal">Send your files</Link>
          </div>
        )}
      </section>
    </>
  );
}

function UnpaidInvoices() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase().from('invoices').select('*, projects(id,title,artist)').eq('status', 'unpaid').order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => setRows(error ? [] : data || []));
  }, []);
  if (!rows?.length) return null;
  const total = rows.reduce((n, i) => n + (Number(i.amount) || 0), 0);
  const today = todayISO();
  return (
    <div className="invhome">
      <div className="invhome-h"><b>Unpaid invoices</b><span className="mono">{rows.length} · ${total.toLocaleString()}</span></div>
      <ul>{rows.slice(0, 5).map((i) => (
        <li key={i.id}><Link href={`/p/${i.projects?.id}`}><span>{i.projects?.artist} · {i.projects?.title}{i.number ? ` · #${i.number}` : ''}</span>
          <small className={i.due_date && i.due_date < today ? 'late' : ''}>{i.amount != null ? `$${Number(i.amount).toLocaleString()}` : ''}{i.due_date ? ` · due ${fmtDate(i.due_date)}` : ''}{i.lock ? ' · 🔒' : ''}{i.visible ? '' : ' · private'}</small></Link></li>
      ))}</ul>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { artOf } from '@/lib/art';
import { todayISO, addDaysISO, fmtDate, statusText } from '@/lib/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function CalendarPage() {
  const { eng, session } = useApp();
  const [projects, setProjects] = useState(null);
  const today = todayISO();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [drag, setDrag] = useState(null);
  const [overDay, setOverDay] = useState(null);
  const [sub, setSub] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase().from('projects').select('id,title,artist,type,release,seed,cover_path,archived,settings, songs(id,title,status,eta,seed,cover_path,approved_version,received_at,downloaded_at,mixing_at)').eq('archived', false);
    setProjects(data || []);
  }, []);
  useEffect(() => { if (eng) load(); }, [eng, load]);

  const { byDay, unscheduled } = useMemo(() => {
    const byDay = {}, unscheduled = [];
    for (const p of projects || []) {
      for (const s of p.songs || []) {
        const item = { kind: 'song', id: s.id, title: s.title, p, s };
        if (s.eta) (byDay[s.eta] ||= []).push(item);
        else if (s.status !== 'approved') unscheduled.push(item);
      }
      if (p.release) (byDay[p.release] ||= []).push({ kind: 'release', id: p.id, title: p.title, p });
      if (p.settings?.due) (byDay[p.settings.due] ||= []).unshift({ kind: 'project', id: p.id, title: p.title, p });
    }
    return { byDay, unscheduled };
  }, [projects]);

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Calendar' }]} /><section className="page"><p className="muted">This page is for your engineer.</p></section></>;

  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay(), daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const gridStart = addDaysISO(iso(cursor.y, cursor.m, 1), -startDow);
  const weeks = Math.ceil((startDow + daysIn) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDaysISO(gridStart, i));
  const monthKey = iso(cursor.y, cursor.m, 1).slice(0, 7);
  const agenda = Object.keys(byDay).filter((d) => d.startsWith(monthKey)).sort();
  const move = (dm) => setCursor((c) => { const d = new Date(c.y, c.m + dm, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const reschedule = async (item, day) => {
    setOverDay(null); setDrag(null);
    if (item?.kind === 'project') {
      if ((item.p.settings?.due || null) === day) return;
      const settings = { ...(item.p.settings || {}), due: day };
      if (!day) delete settings.due;
      setProjects((ps) => ps.map((p) => (p.id === item.id ? { ...p, settings } : p)));
      const { error } = await supabase().from('projects').update({ settings }).eq('id', item.id);
      setMsg(error ? error.message : day ? `${item.title} is due ${fmtDate(day)}.` : `${item.title} has no due date now.`);
      if (error) load();
      return;
    }
    if (!item || item.kind !== 'song' || item.s.eta === day) return;
    setProjects((ps) => ps.map((p) => ({ ...p, songs: (p.songs || []).map((s) => (s.id === item.id ? { ...s, eta: day } : s)) })));
    const { error } = await supabase().from('songs').update({ eta: day }).eq('id', item.id);
    setMsg(error ? error.message : `${item.title} is now due ${day ? fmtDate(day) : '(no date)'}.`);
    if (error) load();
  };
  const openSub = async () => {
    setShowSub(!showSub);
    if (!sub) { try { setSub(await api('/api/calendar', {})); } catch (e) { setMsg(e.message); } }
  };
  const resetSub = async () => {
    if (!confirm('Make a new calendar link? Calendars using the old one will stop updating.')) return;
    try { setSub(await api('/api/calendar', { reset: true })); setMsg('New link made. Subscribe again with it.'); } catch (e) { setMsg(e.message); }
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); setMsg('Link copied.'); } catch {} };

  const Chip = ({ item }) => {
    const late = item.kind === 'song' && item.s.eta && item.s.eta < today && item.s.status !== 'approved';
    if (item.kind === 'project') {
      return <Link className="calchip proj" href={`/p/${item.id}`} draggable
        onDragStart={(e) => { setDrag(item); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }}
        onDragEnd={() => { setDrag(null); setOverDay(null); }} title={`${item.title} · ${item.p.artist} · project due`}>
        <Cover {...artOf(null, item.p)} size={40} className="calpart" /><b>{item.title}</b><span>{item.p.artist}</span></Link>;
    }
    return item.kind === 'release'
      ? <Link className="calchip rel" href={`/p/${item.id}`} title={`${item.p.title} release`}><span aria-hidden="true">★</span>{item.p.title}</Link>
      : <Link className={`calchip ${item.s.status} ${late ? 'late' : ''}`} href={`/s/${item.id}`} draggable
          onDragStart={(e) => { setDrag(item); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }}
          onDragEnd={() => { setDrag(null); setOverDay(null); }}
          title={`${item.title} · ${item.p.artist} · ${statusText(item.s)}`}>
          <i className={`dot ${item.s.status}`} /><b>{item.title}</b><span>{item.p.artist}</span></Link>;
  };

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Calendar' }]} />
      <section className="page">
        <div className="calhead">
          <div><h1 className="up">{MONTHS[cursor.m]} <span className="muted">{cursor.y}</span></h1>
            <p className="lede" style={{ margin: 0 }}>Due dates and releases. Drag a song to another day to move it.</p></div>
          <div className="row-actions">
            <button className="btn small" onClick={() => move(-1)} aria-label="Previous month">‹</button>
            <button className="btn small" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>Today</button>
            <button className="btn small" onClick={() => move(1)} aria-label="Next month">›</button>
            <button className="btn small primary" onClick={openSub}>Add to my calendar</button>
          </div>
        </div>

        {showSub && (
          <div className="panel calsub">
            <h3>See due dates in Apple Calendar or Google Calendar</h3>
            <p className="muted small" style={{ margin: 0 }}>Subscribe once and it keeps itself up to date, including dates you change here or clients set in the Portal. This link is private, so don’t share it.</p>
            {!sub ? <p className="muted small">Making your link…</p> : <>
              <div className="row-actions">
                <a className="btn small primary" href={sub.webcal}>Open in Apple Calendar</a>
                <a className="btn small" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(sub.webcal)}`} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
                <button className="btn small" onClick={() => copy(sub.https)}>Copy link</button>
                <button className="btn small quiet" onClick={resetSub}>Reset link</button>
              </div>
              <div className="share-link"><code>{sub.https}</code></div>
              <p className="muted small" style={{ margin: 0 }}>iPhone: Settings › Calendar › Accounts › Add Account › Other › Add Subscribed Calendar, then paste the link. Google refreshes subscribed calendars every few hours; Apple about every hour.</p>
            </>}
          </div>
        )}
        {msg && <p className="toast-inline" style={{ margin: '0 0 12px' }}>{msg}</p>}

        {projects === null ? <p className="muted">Loading…</p> : <>
          <div className="calgrid" role="grid" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`}>
            {DOW.map((d) => <div key={d} className="caldow">{d}</div>)}
            {cells.map((d) => {
              const items = byDay[d] || [];
              const out = !d.startsWith(monthKey);
              return (
                <div key={d} className={`calday ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${overDay === d ? 'over' : ''}`}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOverDay(d); } }} onDragLeave={() => setOverDay((x) => (x === d ? null : x))}
                  onDrop={(e) => { e.preventDefault(); reschedule(drag, d); }}>
                  <span className="caln">{Number(d.slice(8))}</span>
                  <div className="calitems">{items.slice(0, 4).map((it) => <Chip key={it.kind + it.id} item={it} />)}
                    {items.length > 4 && <span className="calmore">+{items.length - 4} more</span>}</div>
                </div>
              );
            })}
          </div>

          <div className="calagenda">
            {agenda.length ? agenda.map((d) => (
              <div key={d} className={`agday ${d === today ? 'today' : ''}`}>
                <div className="agdate"><b>{Number(d.slice(8))}</b><span>{DOW[new Date(d + 'T12:00').getDay()]}</span></div>
                <div className="agitems">{byDay[d].map((it) => <Chip key={it.kind + it.id} item={it} />)}</div>
              </div>
            )) : <p className="emptyday">Nothing due in {MONTHS[cursor.m]}.</p>}
          </div>

          <section className={`asec caltray ${drag && (drag.kind === 'project' ? drag.p.settings?.due : drag.s?.eta) ? 'clearzone' : ''}`}
            onDragOver={(e) => { if (drag && (drag.kind === 'project' ? drag.p.settings?.due : drag.s?.eta)) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); reschedule(drag, null); }}>
            <h2 className="h2 up">Projects</h2>
            <p className="muted small" style={{ margin: '0 0 10px' }}>Drag a project onto a day to set when it’s due. Drag it back here to clear the date.</p>
            <div className="caltraylist">
              {(projects || []).filter((p) => (p.songs || []).some((x) => x.status !== 'approved') || p.settings?.due).map((p) => (
                <div key={p.id} className={`caltraycard ${p.settings?.due ? 'dated' : ''}`} draggable
                  onDragStart={(e) => { setDrag({ kind: 'project', id: p.id, title: p.title, p }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
                  onDragEnd={() => { setDrag(null); setOverDay(null); }}>
                  <Cover {...artOf(null, p)} size={120} />
                  <span><b>{p.title}</b><small>{p.artist}{p.settings?.due ? ` · due ${fmtDate(p.settings.due)}` : ''}</small></span>
                  <Link className="caltrayopen" href={`/p/${p.id}`} aria-label={`Open ${p.title}`} onClick={(e) => e.stopPropagation()}>›</Link>
                </div>
              ))}
            </div>
          </section>

          {unscheduled.length > 0 && (
            <section className="asec calun"
              onDragOver={(e) => { if (drag?.s?.eta) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); reschedule(drag, null); }}>
              <h2 className="h2 up">No due date</h2>
              <p className="muted small" style={{ margin: '0 0 10px' }}>Drag one onto a day to schedule it. Drag a scheduled song here to clear its date.</p>
              <div className="calunlist">{unscheduled.map((it) => (
                <div key={it.id} className="calunitem"><Cover {...artOf(it.s, it.p)} size={80} /><Chip item={it} /></div>
              ))}</div>
            </section>
          )}
        </>}
      </section>
    </>
  );
}

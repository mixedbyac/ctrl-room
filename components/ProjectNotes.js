'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const mmss = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);

/** Engineer, on a project: every open note across its songs in one list. Tick them off here or jump to the moment. */
export default function ProjectNotes({ songs, tick = 0 }) {
  const [notes, setNotes] = useState(null);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('ctrl-pnotes') !== '0'; } catch { return true; } });
  const ids = songs.map((s) => s.id).join(',');
  const load = () => {
    if (!ids) { setNotes([]); return; }
    supabase().from('notes').select('*').in('song_id', ids.split(',')).eq('from_client', true).eq('resolved', false).order('created_at')
      .then(({ data }) => setNotes((data || []).filter((n) => !n.parent_id)));
  };
  useEffect(load, [ids, tick]); // eslint-disable-line
  if (!notes?.length) return null;
  const title = (id) => songs.find((s) => s.id === id)?.title || '';
  const bySong = songs.map((s) => ({ s, ns: notes.filter((n) => n.song_id === s.id) })).filter((x) => x.ns.length);
  const done = async (n) => { setNotes((l) => l.filter((x) => x.id !== n.id)); await supabase().from('notes').update({ resolved: true }).eq('id', n.id); };
  const toggle = () => { setOpen(!open); try { localStorage.setItem('ctrl-pnotes', open ? '0' : '1'); } catch {} };
  return (
    <section className="pnotes">
      <button className="pnhead" onClick={toggle} aria-expanded={open}>
        <b>Open notes</b><span className="pncount">{notes.length}</span><span className="pnchev" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && bySong.map(({ s, ns }) => (
        <div key={s.id} className="pnsong">
          <Link className="pnstitle" href={`/s/${s.id}?tab=notes`}>{title(s.id)} <span>›</span></Link>
          <ul>
            {ns.map((n) => (
              <li key={n.id}>
                <button className="cdone" onClick={() => done(n)} aria-label="Mark this note done" title="Mark done">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
                <Link href={`/s/${s.id}?tab=notes${n.t != null ? `&t=${Math.floor(n.t)}` : ''}`} className="pnbody">
                  {n.t != null && <span className="pnt mono">{mmss(n.t)}</span>}
                  <span className="pntext">{n.body}</span>
                  {n.author_name && <small>{n.author_name}</small>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

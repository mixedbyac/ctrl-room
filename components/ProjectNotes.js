'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hashStr } from '@/lib/art';

const mmss = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
const initials = (s) => String(s || '?').replace(/\(.*?\)/g, '').split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const SHOW = 6;

/** Engineer, on a project: the open notes across its songs, folded into a small bar. Open it for one-line rows; click one to see it on the song. */
export default function ProjectNotes({ songs, tick = 0, onOpen }) {
  const [notes, setNotes] = useState(null);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('ctrl-pnotes2') === '1'; } catch { return false; } });
  const [all, setAll] = useState(false);
  const ids = songs.map((s) => s.id).join(',');
  const load = () => {
    if (!ids) { setNotes([]); return; }
    supabase().from('notes').select('*').in('song_id', ids.split(',')).eq('from_client', true).eq('resolved', false).order('created_at')
      .then(({ data }) => setNotes((data || []).filter((n) => !n.parent_id)));
  };
  useEffect(load, [ids, tick]); // eslint-disable-line
  if (!notes?.length) return null;
  const order = songs.map((s) => s.id);
  const sorted = [...notes].sort((a, b) => order.indexOf(a.song_id) - order.indexOf(b.song_id) || (a.t ?? -1) - (b.t ?? -1));
  const many = new Set(notes.map((n) => n.song_id)).size > 1;
  const shown = all ? sorted : sorted.slice(0, SHOW);
  const title = (id) => songs.find((s) => s.id === id)?.title || '';
  const done = async (n) => { setNotes((l) => l.filter((x) => x.id !== n.id)); await supabase().from('notes').update({ resolved: true }).eq('id', n.id); };
  const toggle = () => { setOpen(!open); try { localStorage.setItem('ctrl-pnotes2', open ? '0' : '1'); } catch {} };
  return (
    <section className={`pnotes ${open ? 'open' : ''}`}>
      <button className="pnhead" onClick={toggle} aria-expanded={open}>
        <span className="pncount">{notes.length}</span><b>open note{notes.length > 1 ? 's' : ''}</b>
        <svg className="pnchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="pnlist">
          {shown.map((n) => (
            <li key={n.id}>
              <button className="pnrow" onClick={() => onOpen?.(n.song_id, n.version_id)} title={`${n.author_name || 'Client'}: ${n.body}`}>
                <span className="cav sm" style={{ '--h': hashStr(String(n.author_name || '')) % 360 }} aria-hidden="true">{initials(n.author_name)}</span>
                {many && <span className="pnsong">{title(n.song_id)}</span>}
                {n.t != null ? <span className="ctime">{mmss(n.t)}</span> : <span className="ctime general">General</span>}
                <span className="pntext">{n.body}</span>
              </button>
              <button className="ctool" onClick={() => done(n)} aria-label="Mark this note done" title="Mark done">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </button>
            </li>
          ))}
          {sorted.length > SHOW && <li><button className="pnmore" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${sorted.length}`}</button></li>}
        </ul>
      )}
    </section>
  );
}

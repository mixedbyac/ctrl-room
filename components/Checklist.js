'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';
import { usePlayer } from '@/components/Player';
import { exportToLogic } from '@/lib/midimarkers';
import { isMacApp } from '@/lib/native';
import { mmss } from '@/lib/format';

/**
 * Engineer: every open note from artists, as a checklist. Tick them off as you fix them in Logic.
 * panel = the small always-on-top window in the Mac app (clicking a note plays it in the main window).
 */
export default function Checklist({ panel = false }) {
  const { session, eng } = useApp() || {};
  const pl = usePlayer();
  const [rows, setRows] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [only, setOnly] = useState(null); // song id
  const [msg, setMsg] = useState('');
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get('song')) setOnly(q.get('song')); }, []);
  const load = useCallback(async () => {
    const { data, error } = await supabase().from('notes')
      .select('id, song_id, version_id, t, body, author_name, from_client, resolved, parent_id, created_at, versions(label), songs(id, title, bpm, project_id, projects(id, title, artist, archived))')
      .is('parent_id', null).eq('from_client', true).order('created_at', { ascending: false }).limit(800);
    if (error) { setMsg(error.message); setRows([]); return; }
    setRows((data || []).filter((n) => n.songs && !n.songs.projects?.archived));
  }, []);
  useEffect(() => { if (session && eng) load(); }, [session, eng, load]);
  useEffect(() => { if (!panel) return; const t = setInterval(load, 30000); return () => clearInterval(t); }, [panel, load]); // the Mac window stays fresh

  const groups = useMemo(() => {
    const g = new Map();
    (rows || []).filter((n) => (showDone || !n.resolved) && (!only || n.song_id === only)).forEach((n) => {
      const k = n.song_id;
      if (!g.has(k)) g.set(k, { song: n.songs, notes: [] });
      g.get(k).notes.push(n);
    });
    const out = [...g.values()];
    out.forEach((x) => x.notes.sort((a, b) => (a.t ?? -1) - (b.t ?? -1)));
    return out.sort((a, b) => b.notes.length - a.notes.length);
  }, [rows, showDone, only]);
  const open = (rows || []).filter((n) => !n.resolved).length;

  const tick = async (n) => {
    setRows((rs) => rs.map((x) => (x.id === n.id ? { ...x, resolved: !n.resolved } : x)));
    const { error } = await supabase().from('notes').update({ resolved: !n.resolved }).eq('id', n.id);
    if (error) { setMsg(error.message); load(); }
  };
  const jump = (n) => {
    const at = n.t ?? 0;
    if (panel && isMacApp()) { window.webkit?.messageHandlers?.ctrlroom?.postMessage({ type: 'jump', songId: n.song_id, versionId: n.version_id || '', t: at }); return; }
    pl?.play({ songId: n.song_id, versionId: n.version_id || undefined, at });
  };
  const logic = (grp) => {
    const all = (rows || []).filter((n) => n.song_id === grp.song.id);
    const k = exportToLogic({ song: grp.song, notes: all, bpm: grp.song.bpm });
    setMsg(k ? `Saved ${k} marker${k > 1 ? 's' : ''} for ${grp.song.title}. Drag the .mid file into your Logic session.` : 'No timed notes to turn into markers.');
    setTimeout(() => setMsg(''), 6000);
  };

  if (!session) return null;
  if (!eng) return <p className="muted" style={{ padding: 20 }}>The notes checklist is for engineers.</p>;
  return (
    <div className={`ckl ${panel ? 'panel' : ''}`}>
      <div className="cklhead">
        <div><h1 className={panel ? '' : 'up'}>{panel ? 'Notes' : 'Notes checklist'}</h1><p className="muted small">{open} open{only ? ' · this song' : ''}</p></div>
        <div className="cklctl">
          {only && <button className="btn small quiet" onClick={() => setOnly(null)}>All songs</button>}
          <label className="mailart" style={{ margin: 0 }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>
          {!panel && isMacApp() && <button className="btn small" onClick={() => window.webkit?.messageHandlers?.ctrlroom?.postMessage({ type: 'checklist' })}>Float over Logic</button>}
        </div>
      </div>
      {msg && <p className="toast-inline">{msg}</p>}
      {rows === null ? <p className="muted">Loading…</p> : !groups.length ? (
        <div className="empty-state"><strong>{showDone ? 'No notes yet' : 'All caught up'}</strong>{showDone ? 'Notes from artists show up here.' : 'Every note is ticked off. New ones from artists land here.'}</div>
      ) : groups.map((grp) => (
        <section key={grp.song.id} className="cklsong">
          <div className="cklsonghead">
            <span><b>{grp.song.title}</b><small>{grp.song.projects?.artist}{grp.song.projects?.title && grp.song.projects.title !== grp.song.title ? ` · ${grp.song.projects.title}` : ''}</small></span>
            <span className="cklacts">
              <button className="btn small quiet" onClick={() => logic(grp)} title="Download a MIDI file of markers to drag into Logic">Logic markers</button>
              {!panel && <Link className="btn small quiet" href={`/s/${grp.song.id}#notes`}>Open</Link>}
              {!only && <button className="btn small quiet" onClick={() => setOnly(grp.song.id)}>Just this</button>}
            </span>
          </div>
          <ul className="ckllist">
            {grp.notes.map((n) => (
              <li key={n.id} className={n.resolved ? 'done' : ''}>
                <button className={`cklbox ${n.resolved ? 'on' : ''}`} role="checkbox" aria-checked={!!n.resolved} aria-label={n.resolved ? 'Mark as not done' : 'Mark as done'} onClick={() => tick(n)}>
                  {n.resolved && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </button>
                <button className="ckltime mono" onClick={() => jump(n)} title={n.t != null ? `Play from ${mmss(n.t)}` : 'Play the song'}>{n.t != null ? mmss(n.t) : 'Gen'}</button>
                <span className="ckltext"><span>{n.body}</span><small>{(n.author_name || 'Client').replace(/\s*\(.*?\)\s*/g, ' ').trim()}{n.versions?.label ? ` · ${n.versions.label}` : ''}</small></span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

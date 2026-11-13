'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useLive } from '@/lib/live';
import { usePlayer } from '@/components/Player';
import { useApp } from '@/components/AppShell';
import Cover from '@/components/Cover';
import { artOf } from '@/lib/art';
import { orderVersions, currentMix, isDemo } from '@/lib/format';
import { pingDownload } from '@/lib/pushclient';
import { StackIcon } from '@/components/VersionStack';
import { Scrub, Notes } from '@/components/SongNotes';
import InlineText from '@/components/InlineText';

const PLAY = <path d="M7 4.5v15l13-7.5z" />;
const PAUSE = <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" />;

/**
 * One song, right inside the project page (like a "Listen" view): cover, title, a version picker,
 * the waveform with note markers, the comment box and the comments for that version.
 */
export default function TrackView({ songId, versionId, project, queue, onBack, onVersion, locked = false, onLocked, onRenamed }) {
  const { eng, email, session } = useApp();
  const pl = usePlayer();
  const [song, setSong] = useState(null);
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [pick, setPick] = useState(false);
  const [naming, setNaming] = useState(false);
  const pickBox = useRef(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: s }, { data: vs }, { data: ns }] = await Promise.all([
      sb.from('songs').select('*').eq('id', songId).single(),
      sb.from('versions').select('*').eq('song_id', songId).order('created_at'),
      sb.from('notes').select('*').eq('song_id', songId).order('created_at'),
    ]);
    if (!s) return;
    const list = orderVersions(vs || []);
    setSong(s); setVersions(list); setNotes(ns || []);
    const ids = (ns || []).map((n) => n.id);
    if (ids.length) sb.from('note_reactions').select('note_id, emoji, who').in('note_id', ids).then(({ data, error }) => setReactions(error ? [] : data || []));
    else setReactions([]);
    pl.refresh?.(songId, list);
  }, [songId]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useLive(load);
  useEffect(() => {
    if (!pick) return;
    const off = (e) => { if (pickBox.current && !pickBox.current.contains(e.target)) setPick(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [pick]);

  const isCur = pl.current?.song?.id === songId;
  const vid = (isCur && pl.current?.versionId) || versionId || (song && (currentMix(song, versions) || versions.at(-1))?.id);
  const v = versions.find((x) => x.id === vid) || null;
  // keep the parent (and the address) on the version that's actually showing
  useEffect(() => { if (vid && vid !== versionId) onVersion?.(vid); }, [vid]); // eslint-disable-line
  const time = isCur ? pl.time : 0, dur = (isCur && pl.duration) || v?.duration || 0;
  const start = (at = 0, id = vid) => {
    if (locked) return onLocked?.();
    return pl.play({ song: { ...song, projects: project }, project, versions, versionId: id, at, queue: queue?.length ? queue : [songId] });
  };
  const toggle = () => (isCur && pl.current?.versionId === vid ? pl.toggle() : start(isCur ? time : 0));
  const seek = (t) => (isCur && pl.current?.versionId === vid ? pl.seek(t) : start(t));
  const choose = (id) => {
    setPick(false);
    if (id === vid) return;
    if (isCur) pl.switchVersion(id); // same spot, keeps playing if it was
    onVersion?.(id);
  };
  const download = async () => {
    if (!v?.storage_path) return;
    const ext = (v.file_name || v.storage_path).match(/\.[a-z0-9]{2,5}$/i)?.[0] || '';
    const name = `${String(song.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim()} ${v.label}${ext}`;
    const { data } = await supabase().storage.from('mixes').createSignedUrl(v.storage_path, 300, { download: name });
    if (!data?.signedUrl) return;
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    pingDownload([v.id]);
  };

  if (!song) return <div className="tview"><button className="tvback" onClick={onBack} aria-label="Back to the project">‹</button><p className="muted" style={{ marginTop: 40 }}>Loading…</p></div>;
  const playingHere = isCur && pl.playing && pl.current?.versionId === vid;
  const canDownload = v?.storage_path && (eng || project?.allow_download);

  return (
    <div className="tview">
      <div className="tvtop">
        <button className="tvback" onClick={onBack} aria-label="Back to the project" title="Back to the project">‹</button>
        <Cover as="div" {...artOf(song, project)} size={160} className="tvart" />
        <div className="tvtitles">
          <span className="tveyebrow">{project.title}</span>
          {eng && naming
            ? <InlineText autoFocus value={song.title} label="Rename song" width={24} className="tvtitle" onDone={() => setNaming(false)}
                onSave={async (t) => { if (!t) return; await supabase().from('songs').update({ title: t }).eq('id', song.id); setSong((x) => ({ ...x, title: t })); onRenamed?.(); }} />
            : <b className="tvtitle" onDoubleClick={() => eng && setNaming(true)} title={eng ? 'Double-click to rename' : undefined}>{song.title}</b>}
        </div>
        <div className="tvacts">
          {versions.length > 0 && (
            <span className="tvpickwrap" ref={pickBox}>
              <button className="tvpick" onClick={() => setPick(!pick)} aria-expanded={pick} title="Switch version"><StackIcon /><span>{v?.label || '—'}</span></button>
              {pick && (
                <div className="tvmenu" role="menu">
                  {[...versions].reverse().map((x) => (
                    <button key={x.id} role="menuitemradio" aria-checked={x.id === vid} className={x.id === vid ? 'on' : ''} onClick={() => choose(x.id)}>
                      <span className="mono">{x.label}</span><small>{x.note && !/^the starting point$/i.test(x.note) ? x.note : x.file_name || (isDemo(x) ? 'Demo' : '')}</small>
                      <em>{notes.filter((n) => n.version_id === x.id && !n.parent_id && !n.resolved).length || ''}</em>
                    </button>
                  ))}
                </div>
              )}
            </span>
          )}
          {eng && <button className="tvicon" onClick={() => setNaming(true)} aria-label="Rename song" title="Rename song"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg></button>}
          {canDownload && <button className="tvicon" onClick={download} aria-label={`Download ${v.label}`} title={`Download ${v.label}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg></button>}
          <Link className="tvicon" href={`/s/${song.id}${vid ? `?v=${vid}` : ''}`} title="Progress, updates and details" aria-label="Open the full song page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg></Link>
        </div>
      </div>

      {v ? (
        <div className="tvwave">
          <button className="tvplay" onClick={toggle} aria-label={playingHere ? 'Pause' : 'Play'}><svg viewBox="0 0 24 24">{playingHere ? PAUSE : PLAY}</svg></button>
          <Scrub {...{ v, notes, time, dur, seek, eng, plays: [] }} />
        </div>
      ) : <div className="nomix"><strong className="up">No mix yet</strong>The first mix will show up here.</div>}

      {v && <div className="tvnotes"><Notes {...{ notes, reactions, v, versions, time, playing: playingHere, seek, setVid: choose, eng, email, meName: session?.user?.user_metadata?.name, song, reload: load }} /></div>}
    </div>
  );
}

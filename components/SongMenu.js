'use client';
import NotifyClient from '@/components/NotifyClient';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ShareButton from '@/components/ShareButton';
import { usePlayer } from '@/components/Player';
import { deliverFile } from '@/lib/deliver';
import { uploadDemo } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { demoOf, currentMix, mmss, shortDate, statusText } from '@/lib/format';

const AUDIO = /\.(wav|aiff?|mp3|m4a|flac)$/i;
const ACCEPT = 'audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac';

/**
 * The ⋯ menu for one song: play, comment, versions, share, more info, and (engineer) deliver new versions / add a demo,
 * rename and move. Used on the tracklist rows and on the song page.
 */
export default function SongMenu({ song, versions = [], project, eng, canEdit, queue, onChange, onVersions, versionsOpen, onRename, onMove, index, count, onPlay, onComment, page = false, setMsg }) {
  const pl = usePlayer();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu'); // 'menu' | 'info'
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [just, setJust] = useState([]);
  const box = useRef(null), mixIn = useRef(null), demoIn = useRef(null);
  const say = (m) => { setNote(m); setMsg?.(m); if (m) setTimeout(() => setNote((x) => (x === m ? '' : x)), 6000); };
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setView('menu'); } };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); setView('menu'); } };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shut = () => { setOpen(false); setView('menu'); };
  const has = versions.length > 0;
  const isCur = pl.current?.song?.id === song.id;
  const last = currentMix(song, versions) || versions.at(-1);
  const demo = demoOf(versions);

  const deliver = async (list) => {
    const files = Array.from(list || []).filter((f) => f.size > 0 && AUDIO.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) return say('Pick WAV, AIFF, FLAC, MP3 or M4A files.');
    let current = versions; const done = [], failed = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await deliverFile({ song: { ...song, projects: project }, versions: current, file: files[i], project, text: false,
          onStatus: (m) => setBusy(files.length > 1 ? `${i + 1}/${files.length} · ${m}` : m) });
        done.push(r.label);
        const { data } = await supabase().from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
        current = data || current;
      } catch (e) { failed.push(`${files[i].name}: ${e.message}`); }
    }
    setBusy('');
    if (done.length) setJust(done.map((label) => ({ songId: song.id, songTitle: song.title, label })));
    say([done.length ? `Added ${done.join(', ')} of ${song.title}. The timeline is updated.` : '', failed.length ? `Couldn’t deliver ${failed.join('; ')}` : ''].filter(Boolean).join(' '));
    if (done.length) onChange?.();
  };
  const addDemo = async (file) => {
    if (!file) return;
    if (!AUDIO.test(file.name)) return say('Pick a WAV, AIFF, FLAC, MP3 or M4A file for the demo.');
    try { const r = await uploadDemo({ songId: song.id, file, onStatus: setBusy }); say(`Added the ${r.label} to ${song.title}.`); onChange?.(); }
    catch (e) { say(e.message); }
    setBusy('');
  };

  const canDownload = has && last?.storage_path && (eng || project?.allow_download);
  const download = async () => {
    shut();
    const name = `${String(song.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim()}${(last.file_name || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || ''}`;
    const { data, error } = await supabase().storage.from('mixes').createSignedUrl(last.storage_path, 300, { download: name });
    if (error) return say(error.message);
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };
  const info = [
    ['Status', statusText(song, versions)],
    ['BPM', song.bpm || '—'],
    ['Key', song.musical_key || '—'],
    ['Length', last?.duration ? mmss(last.duration) : '—'],
    ['Version', last ? `${last.label}${song.active_version ? ' (active)' : ''}` : '—'],
    ['Versions', versions.length || '—'],
    ['Format', last?.file_format ? [last.file_format, last.sample_rate ? `${(last.sample_rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '', last.bit_depth ? `${last.bit_depth}-bit` : ''].filter(Boolean).join(' · ') : '—'],
    ...(eng ? [['Loudness', last?.lufs != null ? `${last.lufs.toFixed(1)} LUFS` : '—'], ['Peak', last?.peak_db != null ? `${last.peak_db.toFixed(1)} dBFS` : '—']] : []),
    ['Updated', last ? shortDate(last.created_at) : '—'],
  ];

  return (
    <span className="smenu" ref={box} onClick={(e) => e.stopPropagation()}>
      <button className="smore" onClick={() => { setOpen(!open); setView('menu'); }} aria-label={`More for ${song.title}`} aria-expanded={open} title="More">
        {busy ? <span className="sbusy" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>}
      </button>
      {sharing && <ShareButton kind="song" id={song.id} eng={eng} title={song.title} open onOpenChange={(o) => { if (!o) setSharing(false); }} hideButton />}
      {(note || busy || just.length > 0) && !open && <span className="snote" role="status">{busy || note}{!busy && just.length > 0 && <span className="snote-act"><NotifyClient deliveries={just} /><button type="button" className="link small" onClick={() => setJust([])}>Not now</button></span>}</span>}
      {open && (
        <div className="spop" role="menu" aria-label={song.title}>
          {view === 'info' ? (
            <>
              <button className="sback" onClick={() => setView('menu')}>‹ {song.title}</button>
              <dl className="sinfo-list">{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>)}</dl>
            </>
          ) : (
            <>
              <p className="spoptitle ttl">{song.title}</p>
              {has && <button role="menuitem" onClick={() => { shut(); onPlay ? onPlay() : isCur ? pl.toggle() : pl.play({ songId: song.id, project, queue }); }}>{isCur && pl.playing ? 'Pause' : 'Play'}</button>}
              {has && <button role="menuitem" onClick={() => { shut(); onComment?.(); }}>Add a comment</button>}
              {has && onVersions && <button role="menuitem" onClick={() => { shut(); onVersions(); }}>{versionsOpen ? 'Hide versions' : `Versions (${versions.length})`}</button>}
              {has && <button role="menuitem" onClick={() => { shut(); setSharing(true); }}>Share song</button>}
              <button role="menuitem" onClick={() => setView('info')}>More info</button>
              {canDownload && <button role="menuitem" onClick={download}>Download {last.label}</button>}
              {eng && <button role="menuitem" onClick={() => { shut(); mixIn.current?.click(); }}>Deliver new versions</button>}
              {(eng || canEdit) && !demo && <button role="menuitem" onClick={() => { shut(); demoIn.current?.click(); }}>Add a demo</button>}
              {canEdit && onRename && <button role="menuitem" onClick={() => { shut(); onRename(); }}>Rename</button>}
              {canEdit && onMove && index > 0 && <button role="menuitem" onClick={() => { shut(); onMove(-1); }}>Move up</button>}
              {canEdit && onMove && index < count - 1 && <button role="menuitem" onClick={() => { shut(); onMove(1); }}>Move down</button>}
              {!page && <Link role="menuitem" href={`/s/${song.id}`} onClick={shut}>All notes &amp; details</Link>}
            </>
          )}
        </div>
      )}
      <input ref={mixIn} type="file" multiple className="vh" accept={ACCEPT} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; deliver(l); }} />
      <input ref={demoIn} type="file" className="vh" accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; addDemo(f); }} />
    </span>
  );
}

export const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
);

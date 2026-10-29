'use client';
import { TitleInput, ArtistPicker, CASES } from '@/components/TitleCase';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { parseMixName, matchSong } from '@/lib/filename';
import { deliverFile } from '@/lib/deliver';
import { takePending } from '@/lib/native';

const AUDIO = /\.(wav|aiff?|mp3|m4a|flac)$/i;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Engineer Home: drop mixes, and projects + songs + versions get created from the file names. */
export default function QuickDrop({ projects, onDone }) {
  const [groups, setGroups] = useState([]);
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(false);
  const knownArtists = [...new Set(projects.map((p) => p.artist))];

  const pick = (list) => {
    const files = Array.from(list || []).filter((f) => f.size > 0 && AUDIO.test(f.name));
    const map = new Map();
    for (const file of files) {
      const parsed = parseMixName(file.name, { knownArtists });
      // a song with this title already exists for this artist? send it there
      const owned = projects.filter((p) => !parsed.artist || norm(p.artist) === norm(parsed.artist));
      const hit = owned.map((p) => ({ p, s: matchSong(p.songs || [], parsed.title) })).find((x) => x.s);
      const artist = parsed.artist || hit?.p.artist || '';
      const key = norm(artist) || '_unknown';
      if (!map.has(key)) {
        const latest = projects.find((p) => norm(p.artist) === norm(artist) && !p.archived);
        map.set(key, { key, artist, target: hit?.p.id || latest?.id || 'new', title: '', type: 'Single', files: [] });
      }
      map.get(key).files.push({ file, title: parsed.title || file.name.replace(/\.[^.]+$/, ''), label: parsed.label, note: parsed.note, state: 'ready', status: '' });
    }
    const gs = [...map.values()].map((g) => {
      const songs = [...new Set(g.files.map((f) => norm(f.title)))];
      return { ...g, title: songs.length === 1 ? g.files[0].title : `${g.artist || 'New'} Project`, type: songs.length === 1 ? 'Single' : 'EP' };
    });
    setGroups(gs);
  };

  const setGroup = (gi, patch) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setFile = (gi, fi, patch) => setGroups((gs) => gs.map((g, i) => (i !== gi ? g : { ...g, files: g.files.map((f, j) => (j === fi ? { ...f, ...patch } : f)) })));

  const go = async () => {
    const missing = groups.find((g) => !g.artist.trim() || (g.target === 'new' && !g.title.trim()));
    if (missing) return alertGroup(missing);
    setBusy(true);
    const sb = supabase();
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      let project = g.target !== 'new' ? projects.find((p) => p.id === g.target) : null;
      try {
        if (!project) {
          const { data, error } = await sb.from('projects').insert({ title: g.title.trim(), artist: g.artist.trim(), type: g.type, seed: Math.floor(Math.random() * 1e9) }).select('*').single();
          if (error) throw new Error(error.message);
          project = { ...data, songs: [] };
          setGroup(gi, { createdId: data.id });
        }
        const { data: existing } = await sb.from('songs').select('*').eq('project_id', project.id);
        const songs = existing || [];
        let pos = songs.reduce((m, s) => Math.max(m, s.position), -1);
        for (let fi = 0; fi < g.files.length; fi++) {
          const f = g.files[fi];
          try {
            setFile(gi, fi, { state: 'working', status: 'Starting…' });
            let song = matchSong(songs, f.title);
            if (!song) {
              const { data, error } = await sb.from('songs').insert({ project_id: project.id, title: f.title.trim(), position: ++pos, seed: Math.floor(Math.random() * 1e9) }).select('*').single();
              if (error) throw new Error(error.message);
              song = data; songs.push(song);
            }
            const { data: vs } = await sb.from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
            const r = await deliverFile({ song, versions: vs || [], file: f.file, project, text: text && !!project.phone, onStatus: (m) => setFile(gi, fi, { status: m }) });
            setFile(gi, fi, { state: 'done', status: `${song.title} · ${r.label}`, songId: song.id });
          } catch (e) { setFile(gi, fi, { state: 'error', status: e.message }); }
        }
        setGroup(gi, { doneId: project.id });
      } catch (e) {
        setGroup(gi, { error: e.message });
      }
    }
    setBusy(false);
    onDone();
  };
  const [warn, setWarn] = useState('');
  function alertGroup(g) { setWarn(!g.artist.trim() ? `Add the artist for ${g.files[0].file.name}.` : 'Give each new project a title.'); }

  // files from the Mac app (Dock icon, Open With, ⌘U)
  const box = useRef(null);
  const [incoming, setIncoming] = useState(0);
  const pickRef = useRef(pick); pickRef.current = pick;
  useEffect(() => {
    const take = () => {
      const files = takePending();
      setIncoming(0);
      if (files.length) { setWarn(''); pickRef.current(files); box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };
    const loading = (e) => setIncoming(e.detail?.count || 1);
    take();
    window.addEventListener('ctrl-room:files', take);
    window.addEventListener('ctrl-room:files-loading', loading);
    return () => { window.removeEventListener('ctrl-room:files', take); window.removeEventListener('ctrl-room:files-loading', loading); };
  }, []);

  const total = groups.reduce((n, g) => n + g.files.length, 0);
  const allDone = total > 0 && groups.every((g) => g.files.every((f) => f.state === 'done'));

  return (
    <section className="hsec" ref={box}>
      <label className={`minidrop ${hot ? 'hot' : ''}`} style={{ cursor: 'pointer', padding: '18px 16px' }}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); setWarn(''); pick(e.dataTransfer?.files); }}>
        <span className="mi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>
        <span className="mt"><b>{incoming ? `Reading ${incoming} file${incoming > 1 ? 's' : ''} from your Mac…` : total ? `${total} mix${total > 1 ? 'es' : ''} ready to deliver` : hot ? "Drop it like it's hot" : 'Drop mixes to deliver'}</b>
          <span>Name them “Artist - Song - Mix 1.wav”. Projects, songs and versions get set up for you.</span></span>
        <input className="vh" type="file" multiple accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={(e) => { setWarn(''); pick(e.target.files); e.target.value = ''; }} />
      </label>

      {groups.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          {!busy && (
            <div className="row-actions small muted" style={{ alignItems: 'center' }}>Style every title:
              <span className="casebtns" role="group" aria-label="Style every title">
                {CASES.map((c) => <button key={c.k} type="button" title={c.title} onClick={() => setGroups((gs) => gs.map((g) => ({ ...g, title: c.fn(g.title), files: g.files.map((f) => (f.state === 'ready' ? { ...f, title: c.fn(f.title) } : f)) })))}>{c.label}</button>)}
              </span>
            </div>
          )}
          {groups.map((g, gi) => {
            const options = projects.filter((p) => !p.archived && (!g.artist || norm(p.artist) === norm(g.artist)));
            return (
              <div key={g.key} style={{ display: 'grid', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                <div className="two">
                  <div className="fld"><label>Artist</label><ArtistPicker value={g.artist} disabled={busy} extra={knownArtists} onChange={(v) => setGroup(gi, { artist: v })} /></div>
                  <div className="fld"><label>Project</label>
                    <select value={g.target} disabled={busy} onChange={(e) => setGroup(gi, { target: e.target.value })}>
                      <option value="new">New project</option>
                      {options.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select></div>
                </div>
                {g.target === 'new' && (
                  <div className="two">
                    <div className="fld"><label>New project title</label><TitleInput value={g.title} disabled={busy} onChange={(v) => setGroup(gi, { title: v })} /></div>
                    <div className="fld"><label>Type</label><select value={g.type} disabled={busy} onChange={(e) => setGroup(gi, { type: e.target.value })}><option>Single</option><option>EP</option><option>Album</option><option>Mixtape</option></select></div>
                  </div>
                )}
                <ul className="act">
                  {g.files.map((f, fi) => (
                    <li key={fi} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 64px', gap: 10, alignItems: 'center' }}>
                      <span className="small muted" style={{ overflowWrap: 'anywhere' }}>{f.file.name}</span>
                      {f.state === 'ready'
                        ? <TitleInput className="sinput" value={f.title} onChange={(v) => setFile(gi, fi, { title: v })} ariaLabel="Song title" />
                        : <span className="small" style={{ color: f.state === 'error' ? 'var(--warn)' : f.state === 'done' ? 'var(--ok)' : 'var(--muted)' }}>{f.status}</span>}
                      <span className="mono small">{f.label || 'next'}{f.note ? ` · ${f.note}` : ''}</span>
                    </li>
                  ))}
                </ul>
                {g.error && <p className="ferr">{g.error}</p>}
                {g.doneId && <Link className="link" href={`/p/${g.doneId}`}>Open {g.target === 'new' ? g.title : projects.find((p) => p.id === g.target)?.title} ›</Link>}
              </div>
            );
          })}
          {warn && <p className="ferr">{warn}</p>}
          <div className="row-actions">
            {!allDone && <button className="btn primary" onClick={go} disabled={busy}>{busy ? 'Delivering…' : `Deliver ${total} mix${total > 1 ? 'es' : ''}`}</button>}
            {!allDone && <label className="smsopt"><input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Text clients (projects with a phone number)</label>}
            {!busy && <button className="btn quiet" onClick={() => setGroups([])}>{allDone ? 'Done' : 'Clear'}</button>}
          </div>
        </div>
      )}
    </section>
  );
}

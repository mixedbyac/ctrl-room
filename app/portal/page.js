'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, api } from '@/lib/supabase';
import { useApp, TopBar, PORTAL_HOSTS, MAIN_SITE } from '@/components/AppShell';

// on sendfileshere.com, links into the app go to the main domain
const appBase = () => (typeof window !== 'undefined' && PORTAL_HOSTS.includes(window.location.hostname.toLowerCase()) ? MAIN_SITE : '');
import Cover from '@/components/Cover';
import { fmtBytes, fmtDate } from '@/lib/format';
import { parseMixName } from '@/lib/filename';

const LIMIT_FILE = 150 * 1024 * 1024;
const blank = () => ({ k: Math.random().toString(36).slice(2), title: '', bpm: '', key: '', ref: '', notes: '', files: [] });

export default function Portal() {
  const { session, email: myEmail, projects } = useApp();
  const [f, setF] = useState({ name: '', artist: '', email: '', phone: '', spotify: '', message: '', title: '', type: 'EP', release: '' });
  const [mode, setMode] = useState('new');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [songs, setSongs] = useState([blank()]);
  const [state, setState] = useState('idle'); // idle | sending | done
  const [progress, setProgress] = useState({ sent: 0, total: 0, file: '' });
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setSong = (k, patch) => setSongs((ss) => ss.map((s) => (s.k === k ? { ...s, ...patch } : s)));

  useEffect(() => {
    if (!myEmail) return;
    const md = session?.user?.user_metadata || {};
    setF((x) => ({ ...x, email: x.email || myEmail, name: x.name || md.name || '', artist: x.artist || md.artist || '', phone: x.phone || md.phone || '', spotify: x.spotify || md.spotify || '' }));
  }, [myEmail]); // eslint-disable-line

  const project = mode === 'new' ? null : projects.find((p) => p.id === mode);
  // no project questions: name and type come from the songs (the engineer can rename later)
  const named = songs.filter((s) => s.title.trim());
  const autoType = songs.length <= 1 ? 'Single' : songs.length <= 6 ? 'EP' : 'Album';
  const autoTitle = songs.length <= 1 ? (named[0]?.title.trim() || '') : `${f.artist.trim() || 'New'} – ${songs.length} songs`;
  const bytes = songs.reduce((n, s) => n + s.files.reduce((m, x) => m + x.size, 0), 0);
  const fileCount = songs.reduce((n, s) => n + s.files.length, 0);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!f.name.trim()) return setErr('Add your name so I know who sent it.');
    if (!f.artist.trim()) return setErr('Add the artist name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Add an email address. You sign in with it to follow along.');
    if (songs.some((s) => !s.title.trim())) return setErr('Every song needs a title.');
    const big = songs.flatMap((s) => s.files).find((x) => x.size > LIMIT_FILE);
    if (big) return setErr(`${big.name} is over 150 MB. Zip it into smaller parts or split it up.`);
    if (!fileCount) return setErr('Add files for at least one song. Drop them on the song they belong to.');

    setState('sending');
    try {
      const r = await api('/api/portal', {
        name: f.name, email: f.email, phone: f.phone, artist: f.artist, spotify: f.spotify, message: f.message,
        projectId: mode === 'new' ? null : mode,
        project: { title: autoTitle || 'Untitled', type: autoType, release: null, seed },
        songs: songs.map((s) => ({ title: s.title, bpm: s.bpm, key: s.key, ref: s.ref, notes: s.notes })),
      });
      const results = [];
      let sent = 0;
      setProgress({ sent: 0, total: bytes, file: '' });
      for (let i = 0; i < songs.length; i++) {
        const s = songs[i], match = r.songs[i];
        let nb = 0;
        for (const file of s.files) {
          const { link } = await api('/api/portal/link', { uploadId: r.uploadId, songId: match.songId, name: file.webkitRelativePath || file.name, size: file.size });
          await putFile(link, file, (loaded) => setProgress({ sent: sent + loaded, total: bytes, file: file.name }));
          sent += file.size; nb += file.size;
        }
        results.push({ songId: match.songId, files: s.files.length, bytes: nb });
      }
      await api('/api/portal/done', { uploadId: r.uploadId, results });
      setResult({ ...r, files: fileCount, bytes });
      setState('done');
    } catch (ex) {
      setErr(ex.message || 'Something went wrong while sending. Try again.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <>
        <TopBar crumbs={[{ label: 'Portal' }]} />
        <section className="page portal">
          <div className="setdone">
            <Cover seed={mode === 'new' ? seed : project?.seed} size={400} />
            <div>
              <h2 className="up">You're set up</h2>
              <p>{result.projectTitle} has {result.songs.length} song{result.songs.length > 1 ? 's' : ''} and {result.files} file{result.files > 1 ? 's' : ''} ({fmtBytes(result.bytes)}) in the CTRL ROOM.
                {session ? ' Your project page shows every step from here.' : ` Sign in with ${f.email} to follow progress and hear every mix.`}{f.phone ? ` You'll get a text at ${f.phone} when a mix is ready.` : ''}</p>
              <div className="dzbtns">
                {session ? <a className="btn primary" href={`${appBase()}/p/${result.projectId}`}>Open the project</a> : <a className="btn primary" href={`${appBase()}/signup?email=${encodeURIComponent(f.email)}&next=${encodeURIComponent(`/p/${result.projectId}`)}`}>Create an account to follow along</a>}
                <button className="btn" onClick={() => { setSongs([blank()]); setState('idle'); setF({ ...f, message: '' }); }}>Send more files</button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const sending = state === 'sending';
  const pct = progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;
  return (
    <>
      <TopBar crumbs={[{ label: 'Portal' }]} />
      <section className="page portal">
        <div>
          <h1 className="up">Start a mix</h1>
          <p className="lede">Tell me about the project, add your songs, and drop the files for each one. This sets up your project page, where you'll follow progress and hear every mix.</p>
        </div>
        <div className="setup">
          <form className="sform" id="pform" onSubmit={submit} noValidate>
            <fieldset className="sec" disabled={sending}>
              <legend><span className="n">1</span>You</legend>
              <div className="two">
                <div className="fld"><label htmlFor="fName">Your name</label><input id="fName" autoComplete="name" value={f.name} onChange={set('name')} /></div>
                <div className="fld"><label htmlFor="fArtist">Artist name</label><input id="fArtist" value={f.artist} onChange={set('artist')} /></div>
                <div className="fld"><label htmlFor="fEmail">Email <span className="opt">you'll sign in with this</span></label><input id="fEmail" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div>
                <div className="fld"><label htmlFor="fPhone">Phone <span className="opt">for text updates</span></label><input id="fPhone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></div>
              </div>
              <div className="fld"><label htmlFor="fSpotify">Artist’s Spotify link <span className="opt">optional · sets up the artist page with their photo and bio</span></label><input id="fSpotify" type="url" inputMode="url" placeholder="https://open.spotify.com/artist/…" value={f.spotify} onChange={set('spotify')} /></div>
            </fieldset>

            <fieldset className="sec" disabled={sending}>
              <legend><span className="n">2</span>Songs</legend>
              {session && projects.filter((p) => !p.archived).length > 0 && (
                <div className="fld addto">
                  <label htmlFor="fAddTo">Add to</label>
                  <select id="fAddTo" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="new">A new project</option>
                    {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.title} · {p.artist}</option>)}
                  </select>
                </div>
              )}
              <div className="songsF">
                {songs.map((s, i) => <SongCard key={s.k} s={s} n={i + 1} artist={f.artist} canRemove={songs.length > 1} onChange={(patch) => setSong(s.k, patch)} onRemove={() => setSongs((ss) => ss.filter((x) => x.k !== s.k))} />)}
              </div>
              <button type="button" className="addsong" onClick={() => setSongs((ss) => [...ss, blank()])}>+ Add another song</button>
            </fieldset>

            <fieldset className="sec" disabled={sending}>
              <legend><span className="n">3</span>Anything else?</legend>
              <div className="fld"><textarea aria-label="Message" value={f.message} onChange={set('message')} placeholder="Deadlines, vibe, things you love about the rough mix…" /></div>
            </fieldset>
          </form>

          <aside className="summary">
            <div className="sumart">
              <Cover seed={mode === 'new' ? seed : project?.seed} size={480} alt="Project cover" />
              {mode === 'new' && !sending && <button type="button" className="shuf" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>Shuffle cover</button>}
            </div>
            <div><p className="sumt up">{mode === 'new' ? (autoTitle || 'Your mix') : project?.title}</p>
              <p className="sums">{mode === 'new' ? `${autoType}${f.artist.trim() ? ` · ${f.artist.trim()}` : ''}` : project?.artist}</p></div>
            <ul className="sumsongs">
              {songs.map((s, i) => <li key={s.k}><span>{s.title || `Song ${i + 1}`}</span><small>{s.files.length ? `${s.files.length} · ${fmtBytes(s.files.reduce((n, x) => n + x.size, 0))}` : 'no files yet'}</small></li>)}
            </ul>
            <div className="meter">
              <div className="pbar"><i style={{ width: `${sending ? pct : 0}%` }} /></div>
              <span>{sending ? `Sending ${progress.file ? progress.file + ' · ' : ''}${pct}%` : `${fileCount} file${fileCount === 1 ? '' : 's'} · ${fmtBytes(bytes)}`}</span>
            </div>
            {err && <p className="ferr">{err}</p>}
            <button className="send" type="submit" form="pform" disabled={sending}>{sending ? 'Sending… keep this page open' : 'Send to the CTRL ROOM'}</button>
            <p className="fine">Files up to 150 MB each. Zip big sessions into parts.</p>
          </aside>
        </div>
      </section>
    </>
  );
}

function SongCard({ s, n, canRemove, onChange, onRemove, artist }) {
  const [hot, setHot] = useState(false);
  const files = useRef(null), folder = useRef(null);
  const add = (list) => {
    const picked = Array.from(list || []).filter((x) => x.size > 0 && !x.name.startsWith('.'));
    const patch = { files: [...s.files, ...picked] };
    if (!s.title.trim() && picked.length) {
      const first = picked[0], folder = first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : '';
      const guess = parseMixName(folder || first.name, { artist }).title;
      if (guess) patch.title = guess;
    }
    onChange(patch);
  };
  const total = s.files.reduce((m, x) => m + x.size, 0);
  return (
    <div className="songcard">
      <div className="sc-h"><b>SONG {String(n).padStart(2, '0')}</b>{canRemove && <button type="button" onClick={onRemove}>Remove</button>}</div>
      <div className="three">
        <div className="fld"><label htmlFor={`t-${s.k}`}>Title</label><input id={`t-${s.k}`} value={s.title} onChange={(e) => onChange({ title: e.target.value })} /></div>
        <div className="fld"><label htmlFor={`b-${s.k}`}>BPM</label><input id={`b-${s.k}`} inputMode="decimal" value={s.bpm} onChange={(e) => onChange({ bpm: e.target.value })} /></div>
        <div className="fld"><label htmlFor={`k-${s.k}`}>Key</label><input id={`k-${s.k}`} value={s.key} onChange={(e) => onChange({ key: e.target.value })} /></div>
      </div>
      <div className="fld"><label htmlFor={`r-${s.k}`}>Reference <span className="opt">a link or a song you want it to feel like</span></label><input id={`r-${s.k}`} value={s.ref} onChange={(e) => onChange({ ref: e.target.value })} /></div>
      <div className="fld"><label htmlFor={`n-${s.k}`}>Notes for this song</label><textarea id={`n-${s.k}`} rows={2} value={s.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="What matters most in this mix?" /></div>
      <div className={`minidrop ${hot ? 'hot' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); add(e.dataTransfer?.files); }}>
        <span className="mi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>
        <span className="mt"><b>{s.files.length ? `${s.files.length} file${s.files.length > 1 ? 's' : ''} · ${fmtBytes(total)}` : (hot ? "Drop it like it's hot" : "Drop this song's files here")}</b>
          <span>{s.files.length ? s.files.slice(0, 3).map((x) => x.name).join(', ') + (s.files.length > 3 ? ` +${s.files.length - 3} more` : '') : 'Stems, session, zip, or rough mix'}</span></span>
        <span className="mb">
          <button type="button" className="clr" style={{ color: 'var(--ink)', background: 'var(--s2)' }} onClick={() => files.current?.click()}>Files</button>
          <button type="button" className="clr" style={{ color: 'var(--ink)', background: 'var(--s2)' }} onClick={() => folder.current?.click()}>Folder</button>
          {s.files.length > 0 && <button type="button" className="clr" onClick={() => onChange({ files: [] })}>Clear</button>}
        </span>
        <input ref={files} className="vh" type="file" multiple onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        <input ref={folder} className="vh" type="file" multiple webkitdirectory="" directory="" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
    </div>
  );
}

function putFile(link, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', link);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Upload of ${file.name} failed (${x.status}).`)));
    x.onerror = () => reject(new Error(`Upload of ${file.name} failed. Check your connection and try again.`));
    x.send(file);
  });
}

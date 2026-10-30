'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { makeZip } from '@/lib/zip';

export const DL_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
function save(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
const say = (m) => window.dispatchEvent(new CustomEvent('ctrl-room:dl-msg', { detail: m }));

async function ask(token, body) {
  const headers = { 'Content-Type': 'application/json' };
  try { const { data } = await supabase().auth.getSession(); if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`; } catch {}
  const r = await fetch('/api/share/download', { method: 'POST', headers, body: JSON.stringify({ t: token, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Couldn’t download.');
  return j;
}

/** One song, from a share link. */
export async function downloadSong(token, songId) {
  try { say('Getting the file…'); const j = await ask(token, { songId }); save(j.files[0].download, j.files[0].name); say(''); }
  catch (e) { say(e.message); }
}

/** The small download icon on each song row (next to the comment icon). */
export function SongDownloadIcon({ token, song }) {
  return (
    <span className="lrowc lrowd" role="button" tabIndex={0} aria-label={`Download ${song.title}`} title="Download this song"
      onClick={(e) => { e.stopPropagation(); downloadSong(token, song.id); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); downloadSong(token, song.id); } }}>{DL_ICON}</span>
  );
}

/** The main Download button on a share link: every song as one zip (or the song, on a one-song link). */
export default function LinkDownload({ token, mode, song, many }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let t;
    const on = (e) => { setMsg(e.detail || ''); clearTimeout(t); if (e.detail && !/…$/.test(e.detail)) t = setTimeout(() => setMsg(''), 7000); };
    window.addEventListener('ctrl-room:dl-msg', on);
    return () => { window.removeEventListener('ctrl-room:dl-msg', on); clearTimeout(t); };
  }, []);
  const all = async () => {
    if (!many) return downloadSong(token, song.id);
    setBusy(true);
    try {
      const j = await ask(token, {});
      const files = [];
      for (let i = 0; i < j.files.length; i++) {
        say(`Getting ${i + 1} of ${j.files.length}…`);
        const r = await fetch(j.files[i].url); if (!r.ok) throw new Error(`Couldn’t get ${j.files[i].name}.`);
        files.push({ name: j.files[i].name, blob: await r.blob() });
      }
      say('Making the zip…');
      const href = URL.createObjectURL(await makeZip(files));
      save(href, j.zipName); setTimeout(() => URL.revokeObjectURL(href), 60000);
      say('');
    } catch (e) { say(e.message); }
    setBusy(false);
  };
  const signin = mode === 'team' && /team/i.test(msg);
  return (
    <span className="ldl">
      <button className="lcommentbtn" onClick={all} disabled={busy} title={mode === 'team' ? 'For the artist’s team' : undefined}>{DL_ICON}{many ? 'Download all' : 'Download'}</button>
      {msg && <span className="ldlmsg" role="status">{msg}{signin && <> <a className="link" href={`/login?next=${encodeURIComponent(`/l/${token}`)}`}>Sign in</a></>}</span>}
    </span>
  );
}

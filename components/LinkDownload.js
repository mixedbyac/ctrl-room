'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { makeZip } from '@/lib/zip';

const ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
function save(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

/** Download buttons on a share link (when the engineer allows it). mode: 'team' | 'anyone'. */
export default function LinkDownload({ token, mode, song, many }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (body) => {
    const headers = { 'Content-Type': 'application/json' };
    try { const { data } = await supabase().auth.getSession(); if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`; } catch {}
    const r = await fetch('/api/share/download', { method: 'POST', headers, body: JSON.stringify({ t: token, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Couldn’t download.'), { status: r.status });
    return j;
  };
  const fail = (e) => { setMsg(e.message); setTimeout(() => setMsg(''), 7000); };
  const one = async () => { setBusy(true); try { const j = await ask({ songId: song.id }); save(j.files[0].download, j.files[0].name); } catch (e) { fail(e); } setBusy(false); };
  const all = async () => {
    setBusy(true);
    try {
      const j = await ask({});
      const files = [];
      for (let i = 0; i < j.files.length; i++) {
        setMsg(`Getting ${i + 1} of ${j.files.length}…`);
        const r = await fetch(j.files[i].url); if (!r.ok) throw new Error(`Couldn’t get ${j.files[i].name}.`);
        files.push({ name: j.files[i].name, blob: await r.blob() });
      }
      setMsg('Making the zip…');
      const href = URL.createObjectURL(await makeZip(files));
      save(href, j.zipName); setTimeout(() => URL.revokeObjectURL(href), 60000);
      setMsg('');
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const signin = /team/i.test(msg) && mode === 'team';
  return (
    <span className="ldl">
      <button className="lcommentbtn" onClick={one} disabled={busy} title={mode === 'team' ? 'For the artist’s team' : 'Download this song'}>{ICON}Download</button>
      {many && <button className="lcommentbtn" onClick={all} disabled={busy}>{ICON}Download all</button>}
      {msg && <span className="ldlmsg" role="status">{msg}{signin && <> <a className="link" href={`/login?next=${encodeURIComponent(`/l/${token}`)}`}>Sign in</a></>}</span>}
    </span>
  );
}

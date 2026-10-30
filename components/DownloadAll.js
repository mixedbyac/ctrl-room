'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { currentMix, orderVersions } from '@/lib/format';
import { makeZip } from '@/lib/zip';

const ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
const ext = (v) => (v.file_name || '').match(/\.[a-z0-9]{2,5}$/i)?.[0] || '';
const safe = (s) => String(s || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim();

function save(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

/** Download icon next to Share / + on a project, shown when downloads are on. One song or all of them as a zip. */
export default function DownloadAll({ p, eng }) {
  const locked = !eng && !p.allow_download;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const rows = (p.songs || []).map((s, i) => {
    const vs = orderVersions(s.versions || []);
    const v = currentMix(s, vs) || vs.at(-1);
    return v?.storage_path ? { s, v, name: `${safe(s.title)}${ext(v)}` } : null;
  }).filter(Boolean);
  // two songs with the same title get “(2)” so neither overwrites the other in the zip
  const seen = {};
  rows.forEach((r) => { const k = r.name.toLowerCase(); seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) r.name = r.name.replace(/(\.[a-z0-9]+)?$/i, ` (${seen[k]})$1`); });
  if (!rows.length) return null;
  const url = async (r, dl) => {
    const { data, error } = await supabase().storage.from('mixes').createSignedUrl(r.v.storage_path, 600, dl ? { download: dl } : undefined);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  };
  const one = async (r) => { setOpen(false); try { save(await url(r, r.name), r.name); } catch (e) { setBusy(e.message); setTimeout(() => setBusy(''), 5000); } };
  const all = async () => {
    setOpen(false);
    try {
      const files = [];
      for (let i = 0; i < rows.length; i++) {
        setBusy(`Getting ${i + 1} of ${rows.length}…`);
        const res = await fetch(await url(rows[i]));
        if (!res.ok) throw new Error(`Couldn’t get ${rows[i].s.title}.`);
        files.push({ name: rows[i].name, blob: await res.blob() });
      }
      setBusy('Making the zip…');
      const blob = await makeZip(files);
      const href = URL.createObjectURL(blob);
      save(href, `${safe(p.artist ? `${p.artist} - ${p.title}` : p.title)}.zip`);
      setTimeout(() => URL.revokeObjectURL(href), 60000);
      setBusy('');
    } catch (e) { setBusy(e.message); setTimeout(() => setBusy(''), 6000); }
  };
  return (
    <span className="dlall" ref={box}>
      <button className={`gear shareicon ${locked ? 'dllocked' : ''}`} aria-disabled={locked || undefined}
        onClick={() => (locked ? (setBusy('Downloads are locked. Your engineer has to turn them on.'), setTimeout(() => setBusy(''), 4000)) : busy ? null : rows.length === 1 ? one(rows[0]) : setOpen(!open))}
        aria-expanded={open} aria-label={locked ? 'Downloads locked' : 'Download'}
        title={locked ? 'Locked · your engineer has to enable downloads' : eng && !p.allow_download ? 'Download (only you can: downloads are off for the artist, turn them on in +)' : 'Download'}>
        {locked && <span className="dllock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg></span>}
        {busy && /…$/.test(busy) ? <span className="sbusy" /> : ICON}
      </button>
      {busy && <span className="dlnote" role="status">{busy}</span>}
      {open && (
        <div className="plusmenu dlmenu" role="menu">
          <button role="menuitem" onClick={all}><span className="pmi">↓</span><span><b>Download all</b><small>{rows.length} songs as one zip</small></span></button>
          {rows.map((r) => (
            <button role="menuitem" key={r.s.id} onClick={() => one(r)}><span className="pmi">♪</span><span><b>{r.s.title}</b><small>{r.v.label}{ext(r.v) ? ` · ${ext(r.v).slice(1).toUpperCase()}` : ''}</small></span></button>
          ))}
        </div>
      )}
    </span>
  );
}

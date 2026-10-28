'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase, api } from '@/lib/supabase';

/**
 * Hover menu over cover art (engineer only): shuffle a new generated cover, upload your own image, or go back to generated.
 * table: 'projects' | 'songs'; row needs id (+ project_id for songs).
 */
export default function CoverMenu({ table, row, onChange, className = '', viaAdmin = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const projectId = table === 'projects' ? row.id : row.project_id;

  const update = async (patch) => {
    const { error } = viaAdmin
      ? await api('/api/admin', { action: 'cover', table, projectId, songId: table === 'songs' ? row.id : undefined, patch }).then(() => ({ error: null }), (e) => ({ error: e }))
      : await supabase().from(table).update(patch).eq('id', row.id);
    if (error) {
      setErr(/cover_path/.test(error.message) ? 'Run the cover update SQL in Supabase first.' : error.message);
      return false;
    }
    window.dispatchEvent(new CustomEvent('ctrl-room:cover', { detail: { table, id: row.id, patch } }));
    onChange?.();
    return true;
  };
  const shuffle = async (e) => {
    e.preventDefault(); e.stopPropagation(); setErr(''); setOpen(false);
    const seed = Math.floor(Math.random() * 1e9);
    // a project's new cover flows to all its songs; a song shuffle gives just that song its own cover
    await update(table === 'songs' ? { cover_path: `gen:${seed}` } : { seed, ...(row.cover_path ? { cover_path: null } : {}) });
  };
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return setErr('Pick an image file (JPG, PNG or WebP).');
    if (f.size > 15 * 1024 * 1024) return setErr('That image is over 15 MB. Try a smaller one.');
    setErr(''); setBusy('Uploading…');
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${projectId}/covers/${table}-${row.id}-${Date.now()}.${ext}`;
    let finalPath = path, error = null;
    if (viaAdmin) {
      try {
        const up = await api('/api/admin', { action: 'cover-upload', table, projectId, songId: table === 'songs' ? row.id : undefined, ext });
        finalPath = up.path;
        ({ error } = await supabase().storage.from('mixes').uploadToSignedUrl(up.path, up.token, f, { contentType: f.type }));
      } catch (e) { error = e; }
    } else ({ error } = await supabase().storage.from('mixes').upload(path, f, { contentType: f.type, upsert: false }));
    if (error) { setBusy(''); return setErr(error.message); }
    await update({ cover_path: finalPath });
    setBusy('');
  };
  const remove = async (e) => { e.preventDefault(); e.stopPropagation(); setErr(''); setOpen(false); await update({ cover_path: null }); };

  return (
    <div ref={box} className={`covermenu ${open ? 'open' : ''} ${className}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="cmhit" aria-label="Change cover art" aria-expanded={open} title="Change cover art"
        onClick={(e) => { e.preventDefault(); setErr(''); setOpen(!open); }} />
      {(open || busy || err) && (
        <div className="cmpop" role="menu">
          {busy ? <span className="cmbusy">{busy}</span> : open && (
            <>
              <button type="button" role="menuitem" onClick={(e) => { e.preventDefault(); setOpen(false); input.current?.click(); }}>Upload new cover</button>
              <button type="button" role="menuitem" onClick={shuffle}>Shuffle a generated cover</button>
              {row.cover_path && <button type="button" role="menuitem" onClick={remove}>{table === 'songs' ? 'Use the project cover' : 'Remove image'}</button>}
            </>
          )}
          {err && <span className="cmerr">{err}</span>}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" className="vh" onChange={upload} />
    </div>
  );
}

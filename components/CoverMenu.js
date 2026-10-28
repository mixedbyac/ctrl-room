'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hover menu over cover art (engineer only): shuffle a new generated cover, upload your own image, or go back to generated.
 * table: 'projects' | 'songs'; row needs id (+ project_id for songs).
 */
export default function CoverMenu({ table, row, onChange, className = '' }) {
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const projectId = table === 'projects' ? row.id : row.project_id;

  const update = async (patch) => {
    const { error } = await supabase().from(table).update(patch).eq('id', row.id);
    if (error) {
      setErr(/cover_path/.test(error.message) ? 'Run the cover update SQL in Supabase first.' : error.message);
      return false;
    }
    window.dispatchEvent(new CustomEvent('ctrl-room:cover', { detail: { table, id: row.id, patch } }));
    onChange?.();
    return true;
  };
  const shuffle = async (e) => {
    e.preventDefault(); e.stopPropagation(); setErr('');
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
    const { error } = await supabase().storage.from('mixes').upload(path, f, { contentType: f.type, upsert: false });
    if (error) { setBusy(''); return setErr(error.message); }
    await update({ cover_path: path });
    setBusy('');
  };
  const remove = async (e) => { e.preventDefault(); e.stopPropagation(); setErr(''); await update({ cover_path: null }); };

  return (
    <div className={`covermenu ${busy || err ? 'show' : ''} ${className}`} onClick={(e) => e.stopPropagation()}>
      {busy ? <span className="cmbusy">{busy}</span> : (
        <>
          <button type="button" onClick={shuffle} title="Shuffle a new generated cover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>Shuffle
          </button>
          <button type="button" onClick={(e) => { e.preventDefault(); input.current?.click(); }} title="Use your own artwork">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>Upload image
          </button>
          {row.cover_path && <button type="button" onClick={remove} title={table === 'songs' ? 'Use the project’s cover again' : 'Go back to a generated cover'}>{table === 'songs' ? 'Use project cover' : 'Remove image'}</button>}
        </>
      )}
      {err && <span className="cmerr">{err}</span>}
      <input ref={input} type="file" accept="image/*" className="vh" onChange={upload} />
    </div>
  );
}

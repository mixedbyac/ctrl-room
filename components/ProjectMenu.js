'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** Right-click menu for a project in the sidebar (engineer): open, archive / restore, delete. */
export default function ProjectMenu({ menu, onClose, onChanged, router }) {
  useEffect(() => {
    if (!menu) return;
    const off = () => onClose();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', off); window.addEventListener('keydown', esc); window.addEventListener('scroll', off, true);
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc); window.removeEventListener('scroll', off, true); };
  }, [menu, onClose]);
  if (!menu) return null;
  const p = menu.project;
  const archive = async () => {
    onClose();
    const { error } = await supabase().from('projects').update({ archived: !p.archived }).eq('id', p.id);
    if (error) return alert(error.message);
    onChanged();
  };
  const remove = async () => {
    onClose();
    if (!window.confirm(`Delete “${p.title}” for good? Every song, mix, note and file in it goes too.`)) return;
    const sb = supabase();
    // remove stored files first (mixes, demos, covers), then the project (songs, versions and notes go with it)
    try {
      const { data: songs } = await sb.from('songs').select('id').eq('project_id', p.id);
      const folders = ['', 'covers', ...(songs || []).map((x) => x.id)];
      for (const f of folders) {
        const prefix = f ? `${p.id}/${f}` : p.id;
        const { data: files } = await sb.storage.from('mixes').list(prefix, { limit: 1000 });
        const paths = (files || []).filter((x) => x.id).map((x) => `${prefix}/${x.name}`);
        if (paths.length) await sb.storage.from('mixes').remove(paths);
      }
    } catch { /* files can be cleaned up later; the project still goes */ }
    const { error } = await sb.from('projects').delete().eq('id', p.id);
    if (error) return alert(error.message);
    onChanged();
    if (window.location.pathname.startsWith(`/p/${p.id}`)) router.push('/');
  };
  const x = Math.min(menu.x, window.innerWidth - 200), y = Math.min(menu.y, window.innerHeight - 160);
  return (
    <div className="ctxmenu" style={{ left: x, top: y }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ctxtitle">{p.title}</p>
      <button role="menuitem" onClick={() => { onClose(); router.push(`/p/${p.id}`); }}>Open</button>
      <button role="menuitem" onClick={archive}>{p.archived ? 'Restore from archive' : 'Archive'}</button>
      <button role="menuitem" className="danger" onClick={remove}>Delete…</button>
    </div>
  );
}

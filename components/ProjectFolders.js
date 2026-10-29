'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';

const SQL = 'Folders need a quick database update: run supabase/017_folders.sql in Supabase.';
const FolderIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H7.5a2 2 0 00-1.9 1.4L3 19z M3 19l2.6-7.6A2 2 0 017.5 10H22l-2.7 7.6a2 2 0 01-1.9 1.4H3z" />
      : <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />}
  </svg>
);

/** Engineer sidebar: projects with folders. The + adds a project or a folder; drag a project onto a folder to file it. */
export default function ProjectFolders({ projects, pathname, onProjectMenu, reloadProjects, router }) {
  const [folders, setFolders] = useState([]);
  const [open, setOpen] = useState(() => { try { return JSON.parse(localStorage.getItem('ctrl-room:folders-open') || '{}'); } catch { return {}; } });
  const [plus, setPlus] = useState(false);
  const [naming, setNaming] = useState(null); // 'new' | folder id
  const [name, setName] = useState('');
  const [over, setOver] = useState(null);
  const [msg, setMsg] = useState('');
  const [fmenu, setFmenu] = useState(null);
  const box = useRef(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase().from('folders').select('*').order('position').order('created_at');
    if (!error) setFolders(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const r = () => load(); window.addEventListener('ctrl-room:folders', r); return () => window.removeEventListener('ctrl-room:folders', r); }, [load]);
  useEffect(() => {
    if (!plus && !fmenu) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) { setPlus(false); setFmenu(null); } };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [plus, fmenu]);
  const toggle = (id) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem('ctrl-room:folders-open', JSON.stringify(n)); } catch {} return n; });
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  const saveName = async () => {
    const t = name.trim(); const which = naming; setNaming(null); setName('');
    if (!t) return;
    if (which === 'new') {
      const { data, error } = await supabase().from('folders').insert({ name: t, position: folders.length }).select('*').single();
      if (error) return say(/folders/.test(error.message) ? SQL : error.message);
      setOpen((o) => ({ ...o, [data.id]: true }));
    } else {
      const { error } = await supabase().from('folders').update({ name: t }).eq('id', which);
      if (error) return say(error.message);
    }
    load();
  };
  const remove = async (f) => {
    setFmenu(null);
    if (!window.confirm(`Delete the folder “${f.name}”? Its projects stay, they just move out of the folder.`)) return;
    await supabase().from('folders').delete().eq('id', f.id);
    load(); reloadProjects();
  };
  const moveTo = async (projectId, folderId) => {
    const { error } = await supabase().from('projects').update({ folder_id: folderId }).eq('id', projectId);
    if (error) return say(/folder_id/.test(error.message) ? SQL : error.message);
    if (folderId) setOpen((o) => ({ ...o, [folderId]: true }));
    reloadProjects();
  };
  const drop = (folderId) => (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('application/x-ctrl-project'); if (id) moveTo(id, folderId); };
  const dragOver = (key) => (e) => { if ([...e.dataTransfer.types].includes('application/x-ctrl-project')) { e.preventDefault(); setOver(key); } };

  const item = (p) => (
    <Link key={p.id} className="navitem" href={`/p/${p.id}`} aria-current={pathname.startsWith(`/p/${p.id}`)} draggable
      onDragStart={(e) => { e.dataTransfer.setData('application/x-ctrl-project', p.id); e.dataTransfer.effectAllowed = 'move'; }}
      onContextMenu={(e) => { e.preventDefault(); onProjectMenu({ project: p, x: e.clientX, y: e.clientY, folders, moveTo }); }}>
      <Cover seed={p.seed} path={p.cover_path} size={64} />{p.title}
    </Link>
  );
  const known = new Set(folders.map((f) => f.id));
  const loose = projects.filter((p) => !p.folder_id || !known.has(p.folder_id));

  return (
    <div ref={box} className="pfolders">
      <div className="navlabelrow">
        <p className="navlabel">Projects</p>
        <button className={`navplus ${plus ? 'on' : ''}`} onClick={() => setPlus(!plus)} aria-label="Add a project or folder" aria-expanded={plus} title="Add">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {plus && (
          <div className="plusmenu" role="menu">
            <button role="menuitem" onClick={() => { setPlus(false); router.push('/?new=1'); window.dispatchEvent(new Event('ctrl-room:new-project')); }}>
              <span className="pmi">♪</span><span><b>New project</b><small>A single, EP or album</small></span></button>
            <button role="menuitem" onClick={() => { setPlus(false); setNaming('new'); setName(''); }}>
              <span className="pmi"><FolderIcon /></span><span><b>New folder</b><small>Group projects together</small></span></button>
          </div>
        )}
      </div>
      {naming === 'new' && (
        <input className="foldername" autoFocus placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNaming(null); setName(''); } }} aria-label="Folder name" />
      )}
      <div style={{ display: 'grid', gap: 2 }}>
        {folders.map((f) => {
          const inside = projects.filter((p) => p.folder_id === f.id);
          return (
            <div key={f.id} className={`pfolder ${over === f.id ? 'over' : ''}`} onDragOver={dragOver(f.id)} onDragLeave={() => setOver(null)} onDrop={drop(f.id)}>
              {naming === f.id ? (
                <input className="foldername" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNaming(null); setName(''); } }} aria-label="Folder name" />
              ) : (
                <button className="navitem foldertitle" onClick={() => toggle(f.id)} aria-expanded={!!open[f.id]} onDoubleClick={() => { setNaming(f.id); setName(f.name); }}
                  onContextMenu={(e) => { e.preventDefault(); setFmenu({ f, x: e.clientX, y: e.clientY }); }}>
                  <span className="navicon"><FolderIcon open={!!open[f.id]} /></span><span className="ftname">{f.name}</span><span className="fcount">{inside.length}</span>
                </button>
              )}
              {open[f.id] && <div className="folderin">{inside.length ? inside.map(item) : <p className="folderempty">Drag projects here</p>}</div>}
            </div>
          );
        })}
        <div className={`pfolder loose ${over === 'none' ? 'over' : ''}`} onDragOver={dragOver('none')} onDragLeave={() => setOver(null)} onDrop={drop(null)}>
          {loose.map(item)}
        </div>
      </div>
      {fmenu && (
        <div className="ctxmenu" style={{ left: Math.min(fmenu.x, window.innerWidth - 200), top: Math.min(fmenu.y, window.innerHeight - 120) }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
          <p className="ctxtitle">{fmenu.f.name}</p>
          <button role="menuitem" onClick={() => { setNaming(fmenu.f.id); setName(fmenu.f.name); setFmenu(null); }}>Rename</button>
          <button role="menuitem" className="danger" onClick={() => remove(fmenu.f)}>Delete folder</button>
        </div>
      )}
      {msg && <p className="foldermsg">{msg}</p>}
    </div>
  );
}

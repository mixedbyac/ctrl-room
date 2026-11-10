'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import QuickDrop from '@/components/QuickDrop';
import { supabase } from '@/lib/supabase';
import { selectWithVersions } from '@/lib/embed';
import { pushPending } from '@/lib/native';

const AUDIO = /\.(wav|aiff?|mp3|m4a|flac)$/i;

/**
 * Engineer, any page: drag mixes onto the window (or hit Upload in the sidebar) and a delivery window opens.
 * Files go to the song with the same name (new versions), or set up new songs/projects, same as Home's drop box.
 * Project pages keep their own drop (straight into that project).
 */
export default function GlobalDrop({ eng, onDone }) {
  const pathname = usePathname() || '/';
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState(null);
  const depth = useRef(0);
  const ownDrop = pathname.startsWith('/p/'); // project pages drop straight into that project

  const load = () => selectWithVersions((V) => supabase().from('projects').select(`*, songs(*, ${V}(id,label,created_at))`).eq('archived', false).order('created_at', { ascending: false }))
    .then(({ data }) => setProjects(data || []));
  const show = (files) => { if (files?.length) pushPending(files); setProjects(null); load(); setOpen(true); };

  useEffect(() => {
    if (!eng) return;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => { if (ownDrop || open || !hasFiles(e)) return; depth.current++; setOver(true); };
    const leave = () => { if (--depth.current <= 0) { depth.current = 0; setOver(false); } };
    const overFn = (e) => { if (!ownDrop && !open && hasFiles(e)) e.preventDefault(); };
    const drop = (e) => {
      depth.current = 0; setOver(false);
      if (ownDrop || open || e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      const files = [...(e.dataTransfer.files || [])].filter((f) => f.size > 0 && AUDIO.test(f.name));
      if (files.length) show(files);
    };
    const openFn = (e) => show(e.detail?.files || []);
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn); window.addEventListener('drop', drop);
    window.addEventListener('ctrl-room:upload', openFn);
    return () => {
      window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn); window.removeEventListener('drop', drop);
      window.removeEventListener('ctrl-room:upload', openFn);
    };
  }, [eng, ownDrop, open]); // eslint-disable-line

  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  if (!eng) return null;
  return (
    <>
      {over && <div className="gdrop" aria-hidden="true"><div><b>Drop to deliver</b><span>New versions go to the song with the same name. New songs get set up.</span></div></div>}
      {open && (
        <div className="gmodal" role="dialog" aria-modal="true" aria-label="Deliver mixes" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="gmodalbox">
            <div className="gmodalhead"><h3>Deliver mixes</h3><button className="btn small quiet" onClick={() => setOpen(false)} aria-label="Close">Close</button></div>
            {projects ? <QuickDrop projects={projects} onDone={() => { load(); onDone?.(); }} /> : <p className="muted small">Loading your projects…</p>}
          </div>
        </div>
      )}
    </>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePlayer } from '@/components/Player';
import InlineText from '@/components/InlineText';
import QualityBadge from '@/components/QualityBadge';
import { deliverFile } from '@/lib/deliver';
import { orderVersions, latestMix, isDemo, shortDate, mmss } from '@/lib/format';

export const StackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17.5l9 5 9-5" opacity=".55" /></svg>
);
const NoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M8 9.5h8M8 12.5h5" /></svg>
);
const baseName = (n) => String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/^\d+-/, '').replace(/[_]+/g, ' ').trim();

/**
 * The versions of one song, opened under its row: play any version, see notes per version,
 * and (engineer) rename on hover, add a version, or delete one.
 */
export default function VersionStack({ song, project, versions, noteCounts = {}, eng, queue, onChange }) {
  const pl = usePlayer();
  const list = [...orderVersions(versions)].reverse(); // newest on top, demo at the bottom
  const latest = latestMix(versions);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [menu, setMenu] = useState(null);
  const file = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const off = (e) => { if (!e.target.closest('.vs-menu, .vs-more')) setMenu(null); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [menu]);

  const playing = (v) => pl.current?.song?.id === song.id && pl.current?.versionId === v.id;
  const play = (v) => {
    if (playing(v)) return pl.toggle();
    if (pl.current?.song?.id === song.id) return pl.switchVersion(v.id) || (!pl.playing && pl.resume());
    pl.play({ songId: song.id, project, versionId: v.id, queue });
  };
  const save = async (v, patch, ok) => {
    const { error } = await supabase().from('versions').update(patch).eq('id', v.id);
    setMsg(error ? error.message : ok); onChange?.();
  };
  const rename = (v, t) => {
    if (!t) return;
    if (versions.some((x) => x.id !== v.id && x.label.toLowerCase() === t.toLowerCase())) return setMsg(`There's already a ${t}.`);
    save(v, { label: t.slice(0, 20) }, `Renamed to ${t}.`);
  };
  const remove = async (v) => {
    setMenu(null);
    if (!window.confirm(`Delete ${v.label} of ${song.title}? Its file and notes go too. This can’t be undone.`)) return;
    const sb = supabase();
    if (song.approved_version === v.id) await sb.from('songs').update({ approved_version: null, approved_at: null, status: 'review' }).eq('id', song.id);
    const { error } = await sb.from('versions').delete().eq('id', v.id);
    if (error) return setMsg(error.message);
    if (v.storage_path) await sb.storage.from('mixes').remove([v.storage_path]).catch(() => {});
    setMsg(`Deleted ${v.label}.`); onChange?.();
  };
  const add = async (files) => {
    const picked = Array.from(files || []).filter((f) => /\.(wav|aiff?|mp3|m4a|flac)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!picked.length) return;
    let current = versions;
    for (let i = 0; i < picked.length; i++) {
      try {
        await deliverFile({ song: { ...song, projects: project }, versions: current, file: picked[i], project, text: i === picked.length - 1, onStatus: (m) => setBusy(m) });
        const { data } = await supabase().from('versions').select('id,label,created_at').eq('song_id', song.id).order('created_at');
        current = data || current;
      } catch (e) { setMsg(`Couldn’t add ${picked[i].name}: ${e.message}`); }
    }
    setBusy(''); onChange?.();
  };

  return (
    <div className="vstack">
      {eng && (
        <button className="vs-add" onClick={() => file.current?.click()} disabled={!!busy}>
          <span className="vs-plus" aria-hidden="true">+</span>{busy || 'Add Version'}
          <input ref={file} type="file" multiple className="vh" accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; add(l); }} />
        </button>
      )}
      {list.map((v) => {
        const on = playing(v), n = noteCounts[v.id] || 0;
        const name = v.note && !/^the starting point$/i.test(v.note) ? v.note : baseName(v.file_name) || `${song.title} ${v.label}`;
        return (
          <div key={v.id} className={`vs-item ${on ? 'on' : ''} ${on && pl.playing ? 'live' : ''} ${isDemo(v) ? 'demo' : ''}`} onClick={() => play(v)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) play(v); }} aria-label={`Play ${v.label}`}>
            <span className="vs-node" aria-hidden="true">{on && pl.playing ? <span className="eq"><span /><span /><span /></span> : null}</span>
            <span className="vs-main">
              {eng ? <InlineText value={name} onSave={(t) => save(v, { note: t || null }, 'Saved.')} width={14} label="Version name" className="vs-name" /> : <b className="vs-name">{name}</b>}
              <small>{[isDemo(v) ? 'Demo' : v.id === latest?.id ? 'Latest' : '', song.approved_version === v.id ? 'Approved' : '', shortDate(v.created_at), v.duration ? mmss(v.duration) : ''].filter(Boolean).join(' · ')}<QualityBadge v={v} short /></small>
            </span>
            <Link className={`vs-notes ${n ? '' : 'none'}`} href={`/s/${song.id}?v=${v.id}#notes`} onClick={(e) => e.stopPropagation()} title={n ? `${n} note${n > 1 ? 's' : ''}` : 'No notes yet'}><NoteIcon /><span>{n}</span></Link>
            <span className="vs-label" onClick={(e) => e.stopPropagation()}>{eng ? <InlineText value={v.label} onSave={(t) => rename(v, t)} width={3} label={`Rename ${v.label}`} className="vs-lab" /> : <span className="mono">{v.label}</span>}</span>
            <span className="vs-moreWrap" onClick={(e) => e.stopPropagation()}>
              <button className="vs-more" aria-label="More" onClick={() => setMenu(menu === v.id ? null : v.id)}>⋯</button>
              {menu === v.id && (
                <div className="vs-menu" role="menu">
                  <button role="menuitem" onClick={() => { setMenu(null); play(v); }}>{on && pl.playing ? 'Pause' : 'Play'}</button>
                  <Link role="menuitem" href={`/s/${song.id}?v=${v.id}`}>Open with notes</Link>
                  {eng && <button role="menuitem" className="danger" onClick={() => remove(v)}>Delete version</button>}
                </div>
              )}
            </span>
          </div>
        );
      })}
      {!list.length && <p className="muted small" style={{ margin: '4px 0 4px 34px' }}>No versions yet.</p>}
      {msg && <p className="toast-inline" style={{ margin: '4px 0 0 34px' }}>{msg}</p>}
    </div>
  );
}

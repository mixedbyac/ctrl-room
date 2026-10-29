'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { creditLine } from '@/lib/credit';

let cache = null, pending = null;
export function loadProfiles(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = supabase().from('engineer_profiles').select('*').then(({ data }) => { cache = data || []; pending = null; return cache; }, () => { pending = null; return []; });
  return pending;
}
export function useProfiles() {
  const [list, setList] = useState(cache || []);
  useEffect(() => { let live = true; loadProfiles().then((l) => live && setList(l)); const r = () => loadProfiles(true).then((l) => live && setList(l)); window.addEventListener('ctrl-room:profile', r); return () => { live = false; window.removeEventListener('ctrl-room:profile', r); }; }, []);
  return list;
}
/** The engineer on a project: the one picked in Edit details, otherwise the main engineer. */
export const engineerFor = (project, list) => {
  const want = String(project?.settings?.engineer || '').toLowerCase();
  return (want && list.find((p) => p.email === want)) || list.find((p) => p.is_main) || null;
};

const SEAL = 'M12.00 1.60 L14.30 3.40 L17.20 2.99 L18.29 5.71 L21.01 6.80 L20.60 9.70 L22.40 12.00 L20.60 14.30 L21.01 17.20 L18.29 18.29 L17.20 21.01 L14.30 20.60 L12.00 22.40 L9.70 20.60 L6.80 21.01 L5.71 18.29 L2.99 17.20 L3.40 14.30 L1.60 12.00 L3.40 9.70 L2.99 6.80 L5.71 5.71 L6.80 2.99 L9.70 3.40Z';
const KINDS = {
  artist: { fill: 'var(--sig, #f5d547)', check: '#0f0f10', tip: 'Verified artist · confirmed by email' },
  engineer: { fill: '#f4f4f5', check: '#0f0f10', tip: 'Verified engineer · confirmed by email' },
  user: { fill: '#9a9aa3', check: '#0f0f10', tip: 'Verified user · confirmed by email' },
};
/**
 * The CTRL ROOM verified seal. Yellow = verified artist, white = verified engineer, gray = verified user.
 * Hover (or long-press) shows what it means.
 */
export const BlueCheck = ({ title, tone, kind }) => {
  const k = kind || (tone === 'gray' ? 'user' : /engineer/i.test(title || '') ? 'engineer' : /artist/i.test(title || '') ? 'artist' : tone === 'white' ? 'engineer' : 'artist');
  const c = KINDS[k];
  return (
    <span className={`seal seal-${k}`} data-tip={c.tip} tabIndex={-1}>
      <svg className="bluecheck" viewBox="0 0 24 24" role="img" aria-label={c.tip}>
        <path d={SEAL} fill={c.fill} stroke={c.fill} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M7.6 12.3l2.9 2.9 5.9-6" fill="none" stroke={c.check} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
};
export const VerifiedSeal = BlueCheck;

/** “Mixed & mastered by AC ✓” for a project. */
/** The little card that opens from a credit: photo, name, what they do, bio, Instagram. */
export function CreditCard({ p }) {
  const who = p.display_name || p.full_name || (p.email || '').replace(/@.*/, '');
  return (
    <span className="ccard" role="dialog" aria-label={`About ${who}`}>
      <span className="cchead">
        <span className="ccav">{p.photo_url ? <img src={p.photo_url} alt="" /> : who[0]?.toUpperCase()}</span>
        <span className="ccname"><b>{who}{p.verified && <BlueCheck kind="engineer" />}</b>
          {p.full_name && p.display_name && p.full_name !== p.display_name && <small>{p.full_name}</small>}</span>
      </span>
      {p.bio && <span className="ccbio">{p.bio.length > 180 ? `${p.bio.slice(0, 180).replace(/\s+\S*$/, '')}…` : p.bio}</span>}
      {p.instagram && <a className="ccig" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>@{p.instagram}</a>}
    </span>
  );
}

/** “Mixed & mastered by AC ✓” for a project. Hover (or tap) for a little card about them. */
export default function Credit({ project, profile: given, className = '' }) {
  const list = useProfiles();
  const p = given || engineerFor(project, list);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  if (!p) return null;
  const hasMore = !!(p.bio || p.instagram);
  return (
    <span ref={box} className={`credit ${hasMore ? 'hascard' : ''} ${open ? 'open' : ''} ${className}`}
      tabIndex={hasMore ? 0 : undefined} onClick={(e) => { if (!hasMore) return; e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      {p.photo_url ? <img src={p.photo_url} alt="" /> : null}
      <span className="ctext">{creditLine(p)}</span>{p.verified && <BlueCheck kind="engineer" />}
      {hasMore && <CreditCard p={p} />}
    </span>
  );
}

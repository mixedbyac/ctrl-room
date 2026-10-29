'use client';
import { useEffect, useState } from 'react';
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

export const BlueCheck = ({ title = 'Verified' }) => (
  <svg className="bluecheck" viewBox="0 0 24 24" role="img" aria-label={title}><title>{title}</title>
    <path d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" fill="#3a9bff" />
    <path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** “Mixed & mastered by AC ✓” for a project. */
export default function Credit({ project, profile: given, className = '' }) {
  const list = useProfiles();
  const p = given || engineerFor(project, list);
  if (!p) return null;
  return (
    <span className={`credit ${className}`}>
      {p.photo_url ? <img src={p.photo_url} alt="" /> : null}
      <span>{creditLine(p)}</span>{p.verified && <BlueCheck title="Verified engineer" />}
    </span>
  );
}

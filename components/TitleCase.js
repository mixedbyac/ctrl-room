'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with', 'x', 'ft', 'ft.', 'feat', 'feat.']);
/** Title Case: every word capitalized (small words stay lowercase unless first), keeps things like "(Remix)" tidy. */
export const titleCase = (s) => String(s || '').toLowerCase().split(/(\s+)/).map((w, i) => {
  if (/^\s+$/.test(w) || !w) return w;
  if (i > 0 && SMALL.has(w.replace(/^[(\[]/, ''))) return w;
  return w.replace(/^([^a-z0-9]*)([a-z0-9])/, (_, p, c) => p + c.toUpperCase());
}).join('');
export const CASES = [
  { k: 'upper', label: 'AA', title: 'ALL CAPS', fn: (s) => String(s || '').toUpperCase() },
  { k: 'title', label: 'Aa', title: 'Title Case', fn: titleCase },
  { k: 'first', label: 'A.', title: 'First letter only', fn: (s) => { const t = String(s || '').toLowerCase(); return t.replace(/^([^a-z0-9]*)([a-z0-9])/, (_, p, c) => p + c.toUpperCase()); } },
  { k: 'lower', label: 'aa', title: 'all lowercase', fn: (s) => String(s || '').toLowerCase() },
];

/** Little AA / Aa / A. / aa buttons that restyle a title. Uses mousedown so an inline editor doesn't lose focus. */
export function CaseButtons({ value, onChange, className = '' }) {
  return (
    <span className={`casebtns ${className}`} role="group" aria-label="Title style">
      {CASES.map((c) => (
        <button key={c.k} type="button" title={c.title} aria-label={c.title} aria-pressed={!!value && c.fn(value) === value}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(c.fn(value))}>{c.label}</button>
      ))}
    </span>
  );
}

/** A text input with the case buttons beside it. */
export function TitleInput({ value, onChange, id, placeholder, autoFocus, disabled, ariaLabel, className = '' }) {
  return (
    <span className={`titleinput ${className}`}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} disabled={disabled} aria-label={ariaLabel} />
      <CaseButtons value={value} onChange={onChange} />
    </span>
  );
}

let artistCache = null;
/** Every artist you work with: from projects plus artists you added by hand. */
export function useArtists() {
  const [list, setList] = useState(artistCache || []);
  useEffect(() => {
    let live = true;
    const sb = supabase();
    Promise.all([sb.from('projects').select('artist'), sb.from('artists').select('name')]).then(([a, b]) => {
      const m = new Map();
      [...(a.data || []).map((x) => x.artist), ...(b.data || []).map((x) => x.name)].forEach((n) => { const t = String(n || '').trim(); if (t && !m.has(t.toLowerCase())) m.set(t.toLowerCase(), t); });
      const out = [...m.values()].sort((x, y) => x.replace(/^the\s+/i, '').localeCompare(y.replace(/^the\s+/i, ''), undefined, { sensitivity: 'base' }));
      artistCache = out; if (live) setList(out);
    });
    return () => { live = false; };
  }, []);
  return list;
}

/** Pick an artist you already have, or switch to typing a new one. */
export function ArtistPicker({ value, onChange, id, disabled, extra = [] }) {
  const known = useArtists();
  const all = [...new Map([...known, ...extra].filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];
  const isKnown = !!value && all.some((n) => n.toLowerCase() === value.trim().toLowerCase());
  const [typing, setTyping] = useState(false);
  useEffect(() => { if (value && !isKnown && all.length) setTyping(true); }, [value, isKnown, all.length]);
  if (typing || !all.length) {
    return (
      <span className="artistpick">
        <TitleInput id={id} value={value} onChange={onChange} placeholder="New artist name" autoFocus={typing} disabled={disabled} ariaLabel="Artist" />
        {all.length > 0 && <button type="button" className="link small" onClick={() => { setTyping(false); onChange(''); }} disabled={disabled}>Pick an existing artist</button>}
      </span>
    );
  }
  return (
    <select id={id} value={isKnown ? all.find((n) => n.toLowerCase() === value.trim().toLowerCase()) : ''} disabled={disabled}
      onChange={(e) => { if (e.target.value === '__new') { setTyping(true); onChange(''); } else onChange(e.target.value); }}>
      <option value="" disabled>Choose an artist…</option>
      {all.map((n) => <option key={n} value={n}>{n}</option>)}
      <option value="__new">+ New artist…</option>
    </select>
  );
}

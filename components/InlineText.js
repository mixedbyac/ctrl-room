'use client';
import { useEffect, useState } from 'react';

/** Text that looks like plain text but is editable on hover (engineer). Enter or clicking away saves, Esc cancels. */
export default function InlineText({ value, onSave, placeholder = '', suffix = '', width = 6, inputMode, label, className = '' }) {
  const [draft, setDraft] = useState(value || '');
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setDraft(value || ''); }, [value, focus]);
  const commit = async () => { setFocus(false); const t = draft.trim(); if (t !== (value || '')) await onSave(t); };
  return (
    <span className={`inl ${className} ${!value ? 'empty' : ''}`} title={`Click to edit ${label || ''}`.trim()}>
      <input value={focus ? draft : (draft || '')} placeholder={placeholder} inputMode={inputMode} aria-label={label} size={Math.max(width, (draft || placeholder).length)}
        onFocus={(e) => { setFocus(true); setTimeout(() => e.target.select(), 0); }} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value || ''); setFocus(false); e.currentTarget.blur(); } }} />
      {value && suffix && !focus && <span className="inl-suf">{suffix}</span>}
    </span>
  );
}

'use client';
import { useState } from 'react';

/** A big title the engineer can rename in place: tap ✎ (or double-click), Enter saves, Esc cancels. */
export default function EditableTitle({ value, canEdit, onSave, label = 'title', className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = async () => {
    const t = draft.trim();
    setEditing(false);
    if (!t || t === value) return setDraft(value);
    await onSave(t);
  };
  if (!canEdit) return <h1 className={`up ${className}`}>{value}</h1>;
  if (editing) {
    return <input className={`titleedit up ${className}`} value={draft} autoFocus maxLength={120} aria-label={`Rename ${label}`}
      onChange={(e) => setDraft(e.target.value)} onBlur={save} onFocus={(e) => e.target.select()}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} />;
  }
  const start = () => { setDraft(value); setEditing(true); };
  return (
    <h1 className={`up titlewrap ${className}`} onDoubleClick={start}>{value}
      <button className="titlepen" onClick={start} aria-label={`Rename ${label}`} title={`Rename ${label}`}>✎</button>
    </h1>
  );
}

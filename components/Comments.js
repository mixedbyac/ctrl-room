'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, ago } from '@/lib/format';
import { hashStr } from '@/lib/art';

export const EMOJIS = ['🔥', '❤️', '👏', '🙌', '😍', '💯', '👀', '🤔', '✅'];
const initials = (s) => String(s || '?').replace(/@.*/, '').replace(/\(link\)/, '').split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const hue = (s) => hashStr(String(s || '')) % 360;

/**
 * Threaded, time-coded comments with emoji reactions.
 * notes: flat list (top-level have no parent_id). reactions: [{ note_id, emoji, who }]. me: who-id for reactions.
 * nameOf(note) -> display name. actions: { reply(parent, body), react(note, emoji, on), resolve?(note), remove?(note) }
 */
export default function CommentList({ notes, reactions = [], me, nameOf, canResolve, canDelete, actions, seek, versionLabel, numbers = {} }) {
  const top = notes.filter((n) => !n.parent_id);
  const kids = useMemo(() => {
    const m = {};
    notes.filter((n) => n.parent_id).sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((n) => { (m[n.parent_id] ||= []).push(n); });
    return m;
  }, [notes]);
  const rx = useMemo(() => {
    const m = {};
    reactions.forEach((r) => { const k = m[r.note_id] ||= {}; const e = k[r.emoji] ||= { n: 0, mine: false }; e.n++; if (r.who === me) e.mine = true; });
    return m;
  }, [reactions, me]);
  if (!top.length) return null;
  return (
    <ul className="cthreads">
      {top.map((n) => <Comment key={n.id} n={n} replies={kids[n.id] || []} {...{ rx, nameOf, canResolve, canDelete, actions, seek, versionLabel, numbers }} />)}
    </ul>
  );
}

function Avatar({ name }) {
  return <span className="cav" style={{ '--h': hue(name) }} aria-hidden="true">{initials(name)}</span>;
}

function Reactions({ n, rx, actions }) {
  const [pick, setPick] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!pick) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setPick(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [pick]);
  const mine = rx[n.id] || {};
  return (
    <div className="creacts" ref={box}>
      {Object.entries(mine).map(([emoji, r]) => (
        <button key={emoji} className={`creact ${r.mine ? 'mine' : ''}`} onClick={() => actions.react(n, emoji, !r.mine)} aria-pressed={r.mine} aria-label={`${emoji} ${r.n}`}><span>{emoji}</span><b>{r.n}</b></button>
      ))}
      <button className="creact add" onClick={() => setPick(!pick)} aria-label="Add a reaction" title="React">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" /></svg>
      </button>
      {pick && (
        <div className="cpicker" role="menu">
          {EMOJIS.map((e) => <button key={e} role="menuitem" onClick={() => { setPick(false); actions.react(n, e, !mine[e]?.mine); }}>{e}</button>)}
        </div>
      )}
    </div>
  );
}

function Comment({ n, replies, rx, nameOf, canResolve, canDelete, actions, seek, versionLabel, numbers }) {
  const [open, setOpen] = useState(replies.length > 0 && replies.length <= 2);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = nameOf(n);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await actions.reply(n, text.trim());
    setBusy(false); setText(''); setReplying(false); setOpen(true);
  };
  const Menu = ({ note }) => (
    <span className="cmore-wrap">
      <button className="cmore" onClick={() => setMenu(menu === note.id ? false : note.id)} aria-label="More">⋯</button>
      {menu === note.id && (
        <div className="cmenu" onMouseLeave={() => setMenu(false)}>
          {note.t != null && <button onClick={() => { setMenu(false); seek(note.t, note.version_id); }}>Play from {fmt(note.t)}</button>}
          {canResolve && !note.parent_id && <button onClick={() => { setMenu(false); actions.resolve(note); }}>{note.resolved ? 'Reopen' : 'Mark resolved'}</button>}
          {canDelete(note) && <button className="danger" onClick={() => { setMenu(false); if (window.confirm('Delete this comment?')) actions.remove(note); }}>Delete</button>}
        </div>
      )}
    </span>
  );
  return (
    <li className={`cthread ${n.resolved ? 'done' : ''} ${replies.length || replying ? 'hasreplies' : ''}`}>
      <div className="chead">
        <Avatar name={name} />
        <b className="cname">{name}</b>
        {n.t != null ? (
          <span className="ctimes">
            <button className="ctime" onClick={() => seek(n.t, n.version_id)} title={`Play from ${fmt(n.t)}`}>{numbers[n.id] ? <i>{numbers[n.id]}</i> : null}{fmt(n.t)}</button>
            {n.t_end != null && <><span className="cdash">–</span><button className="ctime" onClick={() => seek(n.t_end, n.version_id)}>{fmt(n.t_end)}</button></>}
          </span>
        ) : <span className="ctime general">General</span>}
        <span className="cwhen">{ago(n.created_at)}{versionLabel ? ` · ${versionLabel(n.version_id)}` : ''}{n.resolved ? ' · resolved' : ''}</span>
        {(canResolve || canDelete(n) || n.t != null) && <Menu note={n} />}
      </div>
      <div className="cbody">
        <p className="ctext">{n.body}</p>
        <div className="cactions">
          <Reactions n={n} rx={rx} actions={actions} />
          <button className="creply" onClick={() => { setReplying(!replying); setOpen(true); }}>Reply</button>
        </div>
        {replies.length > 0 && !open && <button className="cmorereplies" onClick={() => setOpen(true)}>{replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}</button>}
        {open && replies.length > 0 && (
          <ul className="creplies">
            {replies.map((r) => (
              <li key={r.id} className="creplyitem">
                <div className="chead"><Avatar name={nameOf(r)} /><b className="cname">{nameOf(r)}</b><span className="cwhen">{ago(r.created_at)}</span>{canDelete(r) && <Menu note={r} />}</div>
                <div className="cbody"><p className="ctext">{r.body}</p><div className="cactions"><Reactions n={r} rx={rx} actions={actions} /></div></div>
              </li>
            ))}
            {replies.length > 2 && <li><button className="cmorereplies" onClick={() => setOpen(false)}>Hide replies</button></li>}
          </ul>
        )}
        {replying && (
          <div className="creplybox">
            <textarea rows={1} autoFocus value={text} placeholder={`Reply to ${name.replace(/ \(link\)$/, '')}…`} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') setReplying(false); }} aria-label="Reply" />
            <button className="btn small primary" disabled={busy || !text.trim()} onClick={send}>{busy ? '…' : 'Reply'}</button>
          </div>
        )}
      </div>
    </li>
  );
}

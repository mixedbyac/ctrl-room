'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, ago } from '@/lib/format';
import { hashStr } from '@/lib/art';

export const EMOJIS = ['🔥', '❤️', '👏', '🙌', '😍', '💯', '👀', '🤔', '✅'];
const initials = (s) => String(s || '?').replace(/@.*/, '').replace(/\(link\)/, '').split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const hue = (s) => hashStr(String(s || '')) % 360;

const I = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  reply: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 016 6v5" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
};
const Icon = ({ k }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[k]}</svg>;

/**
 * Time-coded comments, kept quiet: open notes show in full with their tools on hover;
 * for the engineer, notes marked done fold into one-line rows under "Completed" (click one to open it).
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
  const [openDone, setOpenDone] = useState({});
  if (!top.length) return null;
  const done = canResolve ? top.filter((n) => n.resolved) : [];
  const open = canResolve ? top.filter((n) => !n.resolved) : top;
  const props = { rx, nameOf, canResolve, canDelete, actions, seek, versionLabel, numbers };
  return (
    <div className="cwrap">
      {open.length > 0 && <ul className="cthreads">{open.map((n) => <Comment key={n.id} n={n} replies={kids[n.id] || []} {...props} />)}</ul>}
      {done.length > 0 && <>
        <div className="cdivider"><span>Completed</span></div>
        <ul className="cthreads cdonelist">
          {done.map((n) => (openDone[n.id]
            ? <Comment key={n.id} n={n} replies={kids[n.id] || []} {...props} onFold={() => setOpenDone((o) => ({ ...o, [n.id]: false }))} />
            : (
              <li key={n.id} className="crow">
                <button className="crowbtn" onClick={() => setOpenDone((o) => ({ ...o, [n.id]: true }))} title="Open this note">
                  <Avatar name={nameOf(n)} small />
                  {n.t != null ? <span className="ctime">{fmt(n.t)}</span> : <span className="ctime general">General</span>}
                  <span className="crowtext">{n.body}</span>
                  {(kids[n.id] || []).length > 0 && <span className="crowreplies">{kids[n.id].length}</span>}
                </button>
                <button className="ctool on" onClick={() => actions.resolve(n)} title="Reopen" aria-label="Reopen this note"><Icon k="check" /></button>
              </li>
            )))}
        </ul>
      </>}
    </div>
  );
}

function Avatar({ name, small }) {
  return <span className={`cav ${small ? 'sm' : ''}`} style={{ '--h': hue(name) }} aria-hidden="true">{initials(name)}</span>;
}

function useOutside(on, close) {
  const box = useRef(null);
  useEffect(() => {
    if (!on) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [on]); // eslint-disable-line
  return box;
}

function Picker({ n, rx, actions, onClose }) {
  const mine = rx[n.id] || {};
  return (
    <div className="cpicker" role="menu">
      {EMOJIS.map((e) => <button key={e} role="menuitem" onClick={() => { onClose(); actions.react(n, e, !mine[e]?.mine); }}>{e}</button>)}
    </div>
  );
}

function Reactions({ n, rx, actions }) {
  const mine = rx[n.id] || {};
  const list = Object.entries(mine);
  if (!list.length) return null;
  return (
    <div className="creacts">
      {list.map(([emoji, r]) => (
        <button key={emoji} className={`creact ${r.mine ? 'mine' : ''}`} onClick={() => actions.react(n, emoji, !r.mine)} aria-pressed={r.mine} aria-label={`${emoji} ${r.n}`}><span>{emoji}</span><b>{r.n}</b></button>
      ))}
    </div>
  );
}

/** The little tool row that shows when you hover a comment (always there on touch screens). */
function Tools({ n, rx, actions, canResolve, canDelete, onReply, seek }) {
  const [pick, setPick] = useState(false);
  const box = useOutside(pick, () => setPick(false));
  return (
    <div className={`ctools ${pick ? 'stay' : ''}`} ref={box}>
      {canDelete(n) && <button className="ctool" onClick={() => { if (window.confirm('Delete this comment?')) actions.remove(n); }} title="Delete" aria-label="Delete"><Icon k="trash" /></button>}
      {onReply && <button className="ctool" onClick={onReply} title="Reply" aria-label="Reply"><Icon k="reply" /></button>}
      <button className="ctool" onClick={() => setPick(!pick)} title="React" aria-label="Add a reaction"><Icon k="smile" /></button>
      {n.t != null && seek && <button className="ctool" onClick={() => seek(n.t, n.version_id)} title={`Play from ${fmt(n.t)}`} aria-label={`Play from ${fmt(n.t)}`}><Icon k="play" /></button>}
      {/* engineer only: tick a note off once it's done in the mix */}
      {canResolve && !n.parent_id && <button className={`ctool ${n.resolved ? 'on' : ''}`} onClick={() => actions.resolve(n)} title={n.resolved ? 'Reopen' : 'Mark done'} aria-label={n.resolved ? 'Reopen' : 'Mark done'} aria-pressed={!!n.resolved}><Icon k="check" /></button>}
      {pick && <Picker n={n} rx={rx} actions={actions} onClose={() => setPick(false)} />}
    </div>
  );
}

function Comment({ n, replies, rx, nameOf, canResolve, canDelete, actions, seek, versionLabel, numbers, onFold }) {
  const [open, setOpen] = useState(replies.length > 0 && replies.length <= 2);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState(false); // phones: tap a comment to show its tools
  const name = nameOf(n);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await actions.reply(n, text.trim());
    setBusy(false); setText(''); setReplying(false); setOpen(true);
  };
  return (
    <li className={`cthread ${n.resolved && canResolve ? 'done' : ''} ${act ? 'act' : ''}`} onClick={(e) => { if (!e.target.closest('button,a,textarea,input')) setAct(!act); }}>
      <div className="chead">
        <Avatar name={name} />
        <b className="cname">{name}</b>
        {n.t != null ? (
          <span className="ctimes">
            <button className="ctime" onClick={() => seek(n.t, n.version_id)} title={`Play from ${fmt(n.t)}`}>{numbers[n.id] ? <i>{numbers[n.id]}</i> : null}{fmt(n.t)}</button>
            {n.t_end != null && <><span className="cdash">–</span><button className="ctime" onClick={() => seek(n.t_end, n.version_id)}>{fmt(n.t_end)}</button></>}
          </span>
        ) : <span className="ctime general">General</span>}
        <span className="cwhen">{ago(n.created_at)}{versionLabel ? ` · ${versionLabel(n.version_id)}` : ''}</span>
        {onFold && <button className="cfold" onClick={onFold}>Fold</button>}
        <Tools n={n} rx={rx} actions={actions} canResolve={canResolve} canDelete={canDelete} seek={null} onReply={() => { setReplying(!replying); setOpen(true); }} />
      </div>
      <div className="cbody">
        <p className="ctext">{n.body}</p>
        <Reactions n={n} rx={rx} actions={actions} />
        {replies.length > 0 && !open && <button className="cmorereplies" onClick={() => setOpen(true)}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>}
        {open && replies.length > 0 && (
          <ul className="creplies">
            {replies.map((r) => (
              <li key={r.id} className="creplyitem">
                <div className="chead"><Avatar name={nameOf(r)} small /><b className="cname">{nameOf(r)}</b><span className="cwhen">{ago(r.created_at)}</span>
                  <Tools n={r} rx={rx} actions={actions} canResolve={false} canDelete={canDelete} seek={null} /></div>
                <div className="cbody"><p className="ctext">{r.body}</p><Reactions n={r} rx={rx} actions={actions} /></div>
              </li>
            ))}
            {replies.length > 2 && <li><button className="cmorereplies" onClick={() => setOpen(false)}>Hide replies</button></li>}
          </ul>
        )}
        {replying && (
          <div className="creplybox">
            <textarea rows={1} autoFocus value={text} placeholder={`Reply to ${name.replace(/ \(link\)$/, '')}…`} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') setReplying(false); }} aria-label="Reply" />
            <button className="csend" disabled={busy || !text.trim()} onClick={send} aria-label="Send reply"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
          </div>
        )}
      </div>
    </li>
  );
}

'use client';
const STEPS = [['received', 'Files received'], ['mixing', 'Mixing'], ['review', 'Ready to review'], ['approved', 'Approved']];
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/** Where the song is at: a headline, a 4-part bar, and the steps with their dates. steps = { received, mixing, review, approved } (dates or null). */
export function SongProgress({ steps = {} }) {
  const doneCount = STEPS.filter(([k]) => steps[k]).length;
  const at = [...STEPS].reverse().find(([k]) => steps[k]);
  const next = STEPS.find(([k]) => !steps[k]);
  const headline = !at ? 'Waiting on files' : at[0] === 'approved' ? 'Approved, final mix' : at[0] === 'review' ? 'Ready for you to review' : at[0] === 'mixing' ? 'Being mixed' : 'Files are in';
  return (
    <div className="sinfo-card sprog">
      <div className="sprog-head">
        <b>{headline}</b>
        <span>{doneCount === 4 ? 'All done' : `Step ${Math.max(1, doneCount)} of 4${next ? ` · next: ${next[1].toLowerCase()}` : ''}`}</span>
      </div>
      <div className="sprog-bar" aria-hidden="true">{STEPS.map(([k]) => <i key={k} className={steps[k] ? 'on' : ''} />)}</div>
      <ol className="sprog-steps">
        {STEPS.map(([k, label]) => (
          <li key={k} className={`${steps[k] ? 'done' : ''} ${at?.[0] === k ? 'cur' : ''}`}>
            <span className="sdot">{steps[k] ? '✓' : ''}</span><b>{label}</b><span className="sdate">{steps[k] ? day(steps[k]) : '—'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The facts about the mix as a clean list. rows = [[label, value], …] (empty values are skipped). */
export function SongDetails({ rows = [] }) {
  const list = rows.filter(([, v]) => v != null && v !== '');
  return (
    <dl className="sinfo-card sdetails">
      {list.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

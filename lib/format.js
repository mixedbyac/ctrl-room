export const fmt = (t) => {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
};
export const mmss = (t) => {
  t = Math.max(0, t || 0);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};
export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
export const shortDate = (iso) => {
  if (!iso) return '';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
export const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return shortDate(iso);
};
export const fmtBytes = (b) =>
  b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : b > 0 ? Math.max(1, Math.round(b / 1e3)) + ' KB' : '0 KB';
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysISO = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const STATUS = { review: 'Awaiting review', changes: 'Changes requested', approved: 'Approved', progress: 'In progress' };
export function statusText(song, versions = []) {
  if (song.status === 'approved') {
    const v = versions.find((x) => x.id === song.approved_version);
    return `Approved${v ? ' ' + v.label : ''}`;
  }
  if (song.status === 'progress') return song.mixing_at ? 'Mixing' : song.downloaded_at ? 'Files downloaded' : song.received_at ? 'Files received' : 'Waiting on files';
  return STATUS[song.status];
}

/* Demo = the baseline the mixes get compared to. It sits before v1 and never counts as the latest mix. */
export const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));
const byDate = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
export const orderVersions = (vs = []) => [...vs.filter(isDemo).sort(byDate), ...vs.filter((v) => !isDemo(v)).sort(byDate)];
export const mixesOf = (vs = []) => vs.filter((v) => !isDemo(v)).sort(byDate);
export const latestMix = (vs = []) => mixesOf(vs).at(-1) || null;
export const demoOf = (vs = []) => vs.filter(isDemo).sort(byDate).at(-1) || null;
export const nextDemoLabel = (vs = []) => { const n = vs.filter(isDemo).length; return n ? `Demo ${n + 1}` : 'Demo'; };

export function nextLabel(all) {
  const versions = mixesOf(all);
  const last = versions[versions.length - 1];
  const m = last && /^v?(\d+)/i.exec(last.label);
  let n = m ? +m[1] + 1 : versions.length + 1;
  let l = `v${n}`;
  while (all.some((v) => v.label.toLowerCase() === l.toLowerCase())) l = `v${++n}`;
  return l;
}

export function deviceName() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Computer';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${dev} · ${br}`;
}

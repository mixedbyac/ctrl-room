'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/components/AppShell';
import { prefOf } from '@/lib/notify';
import { ago, mmss } from '@/lib/format';
import { useNames, nameFor } from '@/components/Names';

/** The bell: what's happened lately (listens, notes, approvals, new mixes…), filtered by your notification settings. */
export default function Bell() {
  const { session, eng } = useApp();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => session?.user?.user_metadata?.notif_seen || '');
  const box = useRef(null);
  const notify = session?.user?.user_metadata?.notify || {};
  const me = (session?.user?.email || '').toLowerCase();
  const names = useNames(!!eng);
  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase(), since = new Date(Date.now() - 21 * 86400000).toISOString(), out = [];
    const song = 'songs(id,title,project_id,projects(title,artist))';
    if (eng) {
      const [pl, no, up, sends] = await Promise.all([
        prefOf(notify, 'plays', 'app') ? sb.from('plays').select(`id, updated_at, started_at, listener_email, device, source, listened, duration, song_id, ${song}, versions(label)`).gte('started_at', since).order('started_at', { ascending: false }).limit(25) : { data: [] },
        prefOf(notify, 'notes', 'app') ? sb.from('notes').select(`id, created_at, body, t, author_name, from_client, song_id, ${song}`).eq('from_client', true).gte('created_at', since).order('created_at', { ascending: false }).limit(25) : { data: [] },
        prefOf(notify, 'approvals', 'app') ? sb.from('updates').select(`id, created_at, body, song_id, ${song}`).eq('from_client', true).gte('created_at', since).order('created_at', { ascending: false }).limit(25) : { data: [] },
        prefOf(notify, 'uploads', 'app') ? sb.from('uploads').select('id, created_at, name, artist, project_id').gte('created_at', since).order('created_at', { ascending: false }).limit(15) : { data: [] },
      ]);
      (pl.data || []).filter((x) => (x.listener_email || '').toLowerCase() !== me).forEach((x) => out.push({ id: `p${x.id}`, at: x.started_at, icon: '▶', text: <><b>{x.listener_email ? nameFor(names, x.listener_email) : /share/i.test(x.source || '') ? 'Someone on a share link' : 'Someone'}</b> played <b>{x.songs?.title} {x.versions?.label || ''}</b></>, sub: [x.device, x.source].filter(Boolean).join(' · '), href: `/s/${x.song_id}` }));
      (no.data || []).forEach((x) => out.push({ id: `n${x.id}`, at: x.created_at, icon: '✎', text: <><b>{x.author_name || 'Client'}</b> left a note on <b>{x.songs?.title}</b>{x.t != null ? ` at ${mmss(x.t)}` : ''}</>, sub: `“${x.body}”`, href: `/s/${x.song_id}#notes` }));
      (up.data || []).filter((x) => /approv|change/i.test(x.body)).forEach((x) => out.push({ id: `u${x.id}`, at: x.created_at, icon: /approv/i.test(x.body) ? '✓' : '↺', text: <><b>{x.songs?.title}</b>: {x.body}</>, sub: x.songs?.projects?.artist || '', href: `/s/${x.song_id}` }));
      (sends.data || []).forEach((x) => out.push({ id: `s${x.id}`, at: x.created_at, icon: '↑', text: <><b>{x.name}</b> sent files{x.artist ? ` for ${x.artist}` : ''}</>, sub: 'Portal', href: '/portal/inbox' }));
    } else {
      const [up, no] = await Promise.all([
        prefOf(notify, 'mixes', 'app') ? sb.from('updates').select(`id, created_at, body, song_id, ${song}`).eq('from_client', false).gte('created_at', since).order('created_at', { ascending: false }).limit(30) : { data: [] },
        prefOf(notify, 'notes', 'app') ? sb.from('notes').select(`id, created_at, body, t, author_name, song_id, ${song}`).eq('from_client', false).gte('created_at', since).order('created_at', { ascending: false }).limit(25) : { data: [] },
      ]);
      (up.data || []).forEach((x) => out.push({ id: `u${x.id}`, at: x.created_at, icon: /ready/i.test(x.body) ? '♪' : '•', text: <><b>{x.songs?.title}</b>: {x.body}</>, sub: x.songs?.projects?.title || '', href: `/s/${x.song_id}` }));
      (no.data || []).forEach((x) => out.push({ id: `n${x.id}`, at: x.created_at, icon: '✎', text: <><b>Your engineer</b> left a note on <b>{x.songs?.title}</b>{x.t != null ? ` at ${mmss(x.t)}` : ''}</>, sub: `“${x.body}”`, href: `/s/${x.song_id}#notes` }));
    }
    setItems(out.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40));
  }, [session, eng, names]); // eslint-disable-line
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  if (!session) return null;
  const unread = items.filter((x) => !seen || x.at > seen).length;
  const toggle = () => {
    const next = !open; setOpen(next);
    if (next && items.length) { const at = items[0].at; setSeen(at); supabase().auth.updateUser({ data: { notif_seen: at } }).catch(() => {}); }
  };
  return (
    <span className="bell" ref={box}>
      <button className={`bellbtn ${open ? 'on' : ''}`} onClick={toggle} aria-label={unread ? `${unread} new notifications` : 'Notifications'} aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" /><path d="M10 19a2 2 0 004 0" /></svg>
        {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
      </button>
      {open && (
        <div className="bellpop" role="dialog" aria-label="Notifications">
          <div className="bellhead"><b>Notifications</b><Link href="/settings?tab=notifications" onClick={() => setOpen(false)}>Settings</Link></div>
          <div className="belllist">
            {items.length ? items.map((x) => (
              <Link key={x.id} href={x.href} className={`bellitem ${seen && x.at <= seen ? '' : 'new'}`} onClick={() => setOpen(false)}>
                <span className="bellico">{x.icon}</span>
                <span className="belltxt"><span>{x.text}</span>{x.sub && <small>{x.sub}</small>}<small className="bellwhen">{ago(x.at)}</small></span>
              </Link>
            )) : <p className="bellempty">Nothing new. You’ll see listens, notes and updates here.</p>}
          </div>
        </div>
      )}
    </span>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { forRole } from '@/lib/changelog';

const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const SEEN_KEY = 'ctrl-room:whats-new-seen';
export const getSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
export const markSeen = (id) => { try { localStorage.setItem(SEEN_KEY, id); } catch {} window.dispatchEvent(new Event('ctrl-room:seen')); };

/** Shows "there's a new version" when a new build goes live, and "what's new" once after updating. */
export default function UpdateWatcher({ eng }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [news, setNews] = useState(null);

  useEffect(() => {
    if (MY_BUILD === 'dev') return;
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { build } = await r.json();
        if (!stop && build && build !== 'dev' && build !== MY_BUILD) setUpdateReady(true);
      } catch {}
    };
    const t = setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    check();
    return () => { stop = true; clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, []);

  useEffect(() => {
    const list = forRole(eng);
    const seen = getSeen();
    if (!list.length) return;
    if (!seen) { markSeen(list[0].id); return; } // first visit: nothing to announce
    if (seen !== list[0].id) setNews(list[0]);
  }, [eng]);

  const closeNews = () => { if (news) markSeen(news.id); setNews(null); };
  if (!updateReady && !news) return null;
  return (
    <div className="toasts" style={{ pointerEvents: 'auto' }}>
      {updateReady && (
        <div className="toast upd" role="status">
          <img src="/icon-192.png" alt="" className="updicon" />
          <span className="nmain">
            <span className="ntext"><b>There’s a new version of Ctrl Room</b></span>
            <span className="nmeta">Update to get the latest. It only takes a second.</span>
            <span className="row-actions" style={{ marginTop: 6 }}>
              <button className="btn small primary" onClick={() => window.location.reload()}>Update</button>
              <button className="btn small quiet" onClick={() => setUpdateReady(false)}>Later</button>
            </span>
          </span>
        </div>
      )}
      {news && !updateReady && (
        <div className="toast upd" role="status">
          <img src="/icon-192.png" alt="" className="updicon" />
          <span className="nmain">
            <span className="nmeta">What’s new in Ctrl Room</span>
            <span className="ntext"><b>{news.title}</b></span>
            <ul className="updlist">{news.items.slice(0, 3).map((i, k) => <li key={k}>{i.text}</li>)}</ul>
            <span className="row-actions" style={{ marginTop: 6 }}>
              <Link className="btn small primary" href="/whats-new" onClick={closeNews}>See all updates</Link>
              <button className="btn small quiet" onClick={closeNews}>Got it</button>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

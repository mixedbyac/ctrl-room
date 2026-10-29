'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfiles, BlueCheck } from '@/components/Credit';

const I = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  portal: <path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />,
  artist: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
};
const Icon = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

/** Phone navigation: tabs along the bottom, with a "More" sheet for everything else and signing out. */
export default function TabBar({ eng, projects, email, signOut, unseen, verified, meta = {} }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const profiles = useProfiles();
  const prof = eng ? profiles.find((x) => x.email === String(email || '').toLowerCase()) : null;
  const myName = prof?.display_name || prof?.full_name || meta.display_name || meta.name || String(email || '').replace(/@.*/, '');
  const myPhoto = prof?.photo_url || meta.avatar_url || null;
  const av = <span className="tabav">{myPhoto ? <img src={myPhoto} alt="" /> : (myName[0] || '?').toUpperCase()}</span>;
  useEffect(() => { setMore(false); }, [pathname]);
  useEffect(() => {
    if (!more) return;
    const k = (e) => { if (e.key === 'Escape') setMore(false); };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [more]);
  const tabs = eng
    ? [['/', 'Home', I.home], ['/calendar', 'Calendar', I.cal], ['/portal/inbox', 'Portal', I.portal], ['/artists', 'Artists', I.artist]]
    : [['/', 'Home', I.home], ['/portal', 'Portal', I.portal], ...(projects.length ? [['/artists', 'Artist', I.artist]] : [])];
  const on = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {tabs.map(([href, label, d]) => (
          <Link key={href} href={href} className={`tab ${on(href) ? 'on' : ''}`} aria-current={on(href) ? 'page' : undefined}><Icon d={d} /><span>{label}</span></Link>
        ))}
        <button className={`tab tabme ${more ? 'on' : ''}`} onClick={() => setMore(!more)} aria-expanded={more} aria-label="You: settings and more">{av}<span>You</span>{unseen && <i className="tabdot" />}</button>
      </nav>
      {more && (
        <div className="moresheet" role="dialog" aria-label="More">
          <div className="morescrim" onClick={() => setMore(false)} />
          <div className="morepanel">
            <div className="moregrab" aria-hidden="true" />
            <Link href="/settings" className="moreme">{av}<span><b>{myName}{verified && <BlueCheck title="Verified" />}</b><small>{email}</small><small className="siderole">{eng ? 'Engineer' : 'Artist'}</small></span><span className="chev" aria-hidden="true">›</span></Link>
            <div className="moregrid">
              {eng && <Link href="/insights">Insights</Link>}
              {eng && <Link href="/dropbox">Dropbox</Link>}
              {eng && <Link href="/people">People</Link>}
              <Link href="/whats-new">What’s new{unseen && <i className="tabdot" />}</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/protect">How your music is protected</Link>
              {eng && <a href="/mac">Get the Mac app</a>}
            </div>
            <div className="morefoot">
              <button className="btn small" onClick={signOut} style={{ width: '100%' }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

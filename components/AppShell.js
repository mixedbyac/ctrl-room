'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const PUBLIC = ['/login', '/portal'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [eng, setEng] = useState(false);
  const [projects, setProjects] = useState([]);
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reloadProjects = useCallback(async () => {
    const { data } = await supabase().from('projects').select('id,title,artist,seed,archived').order('created_at', { ascending: false });
    setProjects(data || []);
  }, []);

  useEffect(() => {
    if (!session) { setEng(false); setProjects([]); return; }
    supabase().rpc('is_engineer').then(({ data }) => setEng(!!data));
    reloadProjects();
  }, [session, reloadProjects]);

  useEffect(() => {
    if (session === null && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, isPublic, pathname, router]);

  const signOut = async () => { await supabase().auth.signOut(); router.replace('/login'); };
  const value = { session, email: session?.user?.email || '', eng, projects, reloadProjects, signOut };

  if (pathname === '/login') return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  if (session === undefined || (session === null && !isPublic)) {
    return <div className="boot"><img src="/logo.png" alt="" className="bootlogo" /></div>;
  }

  const live = projects.filter((p) => !p.archived);
  return (
    <Ctx.Provider value={value}>
      <div className="frame">
        <aside className="side">
          <Link href="/" className="word"><img className="logo" src="/logo.png" alt="" /><span className="wtxt">Ctrl Room</span></Link>
          {session && (
            <div style={{ display: 'grid', gap: 2 }}>
              <Link className="navitem" href="/" aria-current={pathname === '/'}>
                <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" /></svg></span>Home
              </Link>
              {eng && (
                <Link className="navitem" href="/artists" aria-current={pathname.startsWith('/artists')}>
                  <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg></span>Artists
                </Link>
              )}
            </div>
          )}
          {live.length > 0 && (
            <div>
              <p className="navlabel">Projects</p>
              <div style={{ display: 'grid', gap: 2 }}>
                {live.map((p) => (
                  <Link key={p.id} className="navitem" href={`/p/${p.id}`} aria-current={pathname.startsWith(`/p/${p.id}`)}>
                    <Cover seed={p.seed} size={64} />{p.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="navlabel">Files</p>
            <Link className="navitem" href={eng ? '/portal/inbox' : '/portal'} aria-current={pathname.startsWith('/portal')}>
              <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>Portal
            </Link>
          </div>
          <div className="sidefoot">
            {session ? (
              <>
                <p className="demo">{session.user.email}{eng ? ' · Engineer' : ''}</p>
                <button className="btn small" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <Link className="btn small" href="/login">Sign in</Link>
            )}
          </div>
        </aside>
        <div className="app">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

/** Top bar with breadcrumbs; shows the logo and quick links on phones. */
export function TopBar({ crumbs = [], right = null }) {
  const { eng, session } = useApp();
  return (
    <div className="bar">
      <Link href="/"><img className="barlogo" src="/logo.png" alt="Ctrl Room" /></Link>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span>/</span>}
            {c.href ? <Link href={c.href}>{c.label}</Link> : <b>{c.label}</b>}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {session && eng && <Link className="barportal" href="/artists">Artists</Link>}
        {session && <Link className="barportal" href={eng ? '/portal/inbox' : '/portal'}>Portal</Link>}
        {right}
      </div>
    </div>
  );
}

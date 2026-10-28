'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Cover from '@/components/Cover';
import { PlayerProvider } from '@/components/Player';
import { installNativeBridge, isMacApp } from '@/lib/native';
import MfaGate from '@/components/MfaGate';
import PoweredBy from '@/components/PoweredBy';
import TabBar from '@/components/TabBar';
import ProjectMenu from '@/components/ProjectMenu';
import EnterAnimation, { LogoLoader } from '@/components/EnterAnimation';
import VerifyBanner from '@/components/VerifyBanner';
import UpdateWatcher, { getSeen } from '@/components/UpdateWatcher';
import { forRole } from '@/lib/changelog';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const PUBLIC = ['/login', '/signup', '/portal', '/l', '/protect'];
// domains that show only the Portal (sendfileshere.com)
export const PORTAL_HOSTS = (process.env.NEXT_PUBLIC_PORTAL_DOMAINS || 'sendfileshere.com,www.sendfileshere.com').split(',').map((h) => h.trim().toLowerCase());
export const MAIN_SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://ctrl-room-eight.vercel.app';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [eng, setEng] = useState(false);
  const [projects, setProjects] = useState([]);
  const [portalHost, setPortalHost] = useState(false);
  useEffect(() => setPortalHost(PORTAL_HOSTS.includes(window.location.hostname.toLowerCase())), []);
  const isPublic = portalHost || PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const [loaded, setLoaded] = useState(false); // first project list is in
  const [pmenu, setPmenu] = useState(null); // right-click menu on a sidebar project
  const [showArchived, setShowArchived] = useState(false);
  const reloadProjects = useCallback(async () => {
    const { data } = await supabase().from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
    setLoaded(true);
  }, []);

  // two-step verification: accounts with it on must enter the code before anything loads
  const [needMfa, setNeedMfa] = useState(false);
  const [mfaTick, setMfaTick] = useState(0);
  useEffect(() => {
    if (!session) { setNeedMfa(false); return; }
    supabase().auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => setNeedMfa(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2')).catch(() => setNeedMfa(false));
  }, [session, mfaTick]);

  const [adminArtists, setAdminArtists] = useState([]);
  useEffect(() => {
    if (!session || needMfa) { setAdminArtists([]); return; }
    supabase().from('artist_members').select('artist, role').then(({ data }) => setAdminArtists((data || []).filter((m) => /^admin$/i.test(m.role || '')).map((m) => m.artist.toLowerCase())));
  }, [session, needMfa]);
  useEffect(() => {
    if (!session || needMfa) { setEng(false); setProjects([]); return; }
    supabase().rpc('is_engineer').then(({ data }) => setEng(!!data));
    reloadProjects();
  }, [session, needMfa, reloadProjects]);

  useEffect(() => {
    if (session === null && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, isPublic, pathname, router]);

  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    const check = () => { const l = forRole(eng); setUnseen(!!l[0] && getSeen() !== null && getSeen() !== l[0].id); };
    check();
    window.addEventListener('ctrl-room:seen', check);
    return () => window.removeEventListener('ctrl-room:seen', check);
  }, [eng]);

  const [inMacApp, setInMacApp] = useState(false);
  useEffect(() => setInMacApp(isMacApp()), []);
  // Mac app: files dropped on the Dock icon go to the Home upload box
  useEffect(() => {
    if (!eng) return;
    return installNativeBridge(() => { if (pathname !== '/') router.push('/'); });
  }, [eng, pathname, router]);

  const signOut = async () => { await supabase().auth.signOut(); router.replace('/login'); };
  const canEditArtist = (artist) => eng || adminArtists.includes(String(artist || '').toLowerCase());
  const value = { session, email: session?.user?.email || '', eng, projects, reloadProjects, signOut, canEditArtist };

  if (session && needMfa && !(portalHost || pathname.startsWith('/l/'))) {
    return <Ctx.Provider value={value}><MfaGate onDone={() => setMfaTick((t) => t + 1)} onSignOut={signOut} /></Ctx.Provider>;
  }
  if (portalHost && session !== undefined) return <Ctx.Provider value={value}><div className="portalhost">{children}<PoweredBy /></div></Ctx.Provider>;
  if (pathname === '/login' || pathname === '/signup' || pathname === '/protect' || pathname === '/portal/prep' || pathname.startsWith('/l/')) return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  if (session === undefined || (session === null && !isPublic)) {
    return <LogoLoader />;
  }

  const live = projects.filter((p) => !p.archived);
  return (
    <Ctx.Provider value={value}>
      <PlayerProvider eng={eng}>
      <div className="frame">
        <aside className="side">
          <Link href="/" className="word"><img className="logo" src="/logo.png" alt="" /><span className="wtxt">CTRL ROOM</span></Link>
          {session && (
            <div style={{ display: 'grid', gap: 2 }}>
              <Link className="navitem" href="/" aria-current={pathname === '/'}>
                <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" /></svg></span>Home
              </Link>
              {eng && (
                <Link className="navitem" href="/insights" aria-current={pathname.startsWith('/insights')}>
                  <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg></span>Insights
                </Link>
              )}
              {eng && (
                <Link className="navitem" href="/calendar" aria-current={pathname.startsWith('/calendar')}>
                  <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></span>Calendar
                </Link>
              )}
              {(eng || projects.length > 0) && (
                <Link className="navitem" href="/artists" aria-current={pathname.startsWith('/artists')}>
                  <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg></span>{eng ? 'Artists' : 'Artist page'}
                </Link>
              )}
            </div>
          )}
          {live.length > 0 && (
            <div>
              <p className="navlabel">Projects</p>
              <div style={{ display: 'grid', gap: 2 }}>
                {live.map((p) => (
                  <Link key={p.id} className="navitem" href={`/p/${p.id}`} aria-current={pathname.startsWith(`/p/${p.id}`)}
                    onContextMenu={(e) => { if (!eng) return; e.preventDefault(); setPmenu({ project: p, x: e.clientX, y: e.clientY }); }}>
                    <Cover seed={p.seed} path={p.cover_path} size={64} />{p.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {eng && projects.some((p) => p.archived) && (
            <div>
              <button className="navlabel navtoggle" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived}>Archived ({projects.filter((p) => p.archived).length}) {showArchived ? '▾' : '▸'}</button>
              {showArchived && <div style={{ display: 'grid', gap: 2 }}>
                {projects.filter((p) => p.archived).map((p) => (
                  <Link key={p.id} className="navitem archived" href={`/p/${p.id}`} onContextMenu={(e) => { e.preventDefault(); setPmenu({ project: p, x: e.clientX, y: e.clientY }); }}>
                    <Cover seed={p.seed} path={p.cover_path} size={64} />{p.title}
                  </Link>
                ))}
              </div>}
            </div>
          )}
          <ProjectMenu menu={pmenu} onClose={() => setPmenu(null)} onChanged={reloadProjects} router={router} />
          <div>
            <p className="navlabel">Files</p>
            <Link className="navitem" href={eng ? '/portal/inbox' : '/portal'} aria-current={pathname.startsWith('/portal')}>
              <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>Portal
            </Link>
          </div>
          {session && (
            <Link className="navitem" href="/whats-new" aria-current={pathname === '/whats-new'}>
              <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.4 5.6L20 10l-4.5 3.9L17 20l-5-3-5 3 1.5-6.1L4 10l5.6-1.4z" /></svg></span>What’s new
              {unseen && <span className="newdot" aria-label="New" />}
            </Link>
          )}
          {session && eng && !inMacApp && (
            <a className="navitem" href="/mac">
              <span className="navicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg></span>Get the Mac app
            </a>
          )}
          <div className="sidefoot">
            {session ? (
              <>
                <p className="demo">{session.user.email}{eng ? ' · Engineer' : ''}</p>
                <Link className="seclink" href="/security">Security</Link>
                <button className="btn small" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <Link className="btn small" href="/login">Sign in</Link>
            )}
          </div>
        </aside>
        <div className={`app ${session && !eng ? 'client' : ''}`}>
          {session && !eng && session.user?.app_metadata?.needs_verify && (
            <div className="page" style={{ paddingBottom: 0 }}><VerifyBanner email={session.user.email} onDone={() => { reloadProjects(); setMfaTick((t) => t + 1); }} /></div>
          )}
          {children}
          <PoweredBy />
        </div>
        <EnterAnimation active={!!session && !needMfa} ready={loaded} />
        {session && <UpdateWatcher eng={eng} />}
        {session && <TabBar eng={eng} projects={projects} email={session.user.email} signOut={signOut} unseen={unseen} />}
      </div>
      </PlayerProvider>
    </Ctx.Provider>
  );
}

/** Top bar with breadcrumbs; shows the logo and quick links on phones. */
export function TopBar({ crumbs = [], right = null }) {
  const { eng, session } = useApp();
  return (
    <div className="bar">
      {(() => {
        // phones: a simple Back to wherever you came from (the last linked crumb), else the logo
        const back = [...crumbs].slice(0, -1).reverse().find((c) => c.href);
        return back
          ? <Link className="barback" href={back.href} aria-label={`Back to ${back.label}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>{back.label}</span></Link>
          : null;
      })()}
      <Link href="/" className="barlogowrap"><img className="barlogo" src="/logo.png" alt="CTRL ROOM" /></Link>
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

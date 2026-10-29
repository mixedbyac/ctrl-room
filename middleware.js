import { SITE_URL } from '@/lib/site';
import { NextResponse } from 'next/server';

// sendfileshere.com (or any domain listed in PORTAL_DOMAINS) shows only the Portal.
// Everything else on that domain hands off to the main app domain.
const PORTAL_HOSTS = (process.env.PORTAL_DOMAINS || 'sendfileshere.com,www.sendfileshere.com')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const MAIN = SITE_URL;

// the old Vercel address always goes to ctrl-room.app (same page), for everyone
const OLD_HOSTS = (process.env.OLD_HOSTS || 'ctrl-room-eight.vercel.app').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

export function middleware(req) {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (OLD_HOSTS.includes(host) && !req.nextUrl.pathname.startsWith('/api/dropbox/callback')) {
    const { pathname, search } = req.nextUrl;
    return NextResponse.redirect(new URL(pathname + search, MAIN), 308);
  }
  if (!PORTAL_HOSTS.includes(host)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname === '/') return NextResponse.rewrite(new URL('/portal' + search, req.url));
  if (pathname === '/portal' || pathname === '/portal/prep' || pathname.startsWith('/api/portal') || pathname === '/manifest.webmanifest' || pathname === '/api/version') return NextResponse.next();
  return NextResponse.redirect(new URL(pathname + search, MAIN));
}

export const config = {
  // skip Next's own files and static images
  matcher: ['/((?!_next/|favicon|icon-|apple-icon|logo\\.png).*)'],
};

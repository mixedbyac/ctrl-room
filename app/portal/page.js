import { Suspense } from 'react';
import Portal from './PortalClient';
import { requestInfo } from '@/lib/sharemeta';
import { SITE_URL, PORTAL_URL } from '@/lib/site';

// Link previews for the Portal: a project's file-request link shows "Send files for <project>", the plain Portal its own card.
export async function generateMetadata({ searchParams }) {
  const to = String(searchParams?.to || '').slice(0, 40);
  const info = to ? await requestInfo(to).catch(() => null) : null;
  const title = info ? `SEND FILES FOR ${String(info.title).toUpperCase()}` : 'SEND FILES';
  const description = info ? `Drop stems, sessions and references straight into ${info.title}${info.artist ? ` · ${info.artist}` : ''}. Up to 5 GB.` : 'Send your files to your engineer. Up to 5 GB, no account needed.';
  const image = { url: `${SITE_URL}/og/${info ? `req_${encodeURIComponent(to)}` : 'portal'}.jpg?v=4`, width: 1200, height: 630, alt: title, type: 'image/jpeg' };
  return {
    title, description, robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'Send files here', url: `${PORTAL_URL}/${to ? `?to=${to}` : ''}`, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default function Page() { return <Suspense fallback={null}><Portal /></Suspense>; }

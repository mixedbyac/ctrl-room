import './globals.css';
import './app.css';
import AppShell from '@/components/AppShell';
import { SITE_URL } from '@/lib/site';
import { brandMeta } from '@/lib/previewmeta';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'CTRL ROOM',
  description: 'Listen, leave notes, and approve your mixes.',
  ...brandMeta(), // every page previews as the CTRL ROOM card unless it has its own
  appleWebApp: { capable: true, title: 'CTRL ROOM', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/icon-32.png?v=3', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png' }], apple: '/apple-icon.png?v=3' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f0f10',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

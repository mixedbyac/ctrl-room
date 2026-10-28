import './globals.css';
import './app.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'CTRL ROOM',
  description: 'Listen, leave notes, and approve your mixes.',
  appleWebApp: { capable: true, title: 'CTRL ROOM', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-icon.png' },
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

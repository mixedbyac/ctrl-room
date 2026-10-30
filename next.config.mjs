// Security headers on every page. The CSP only lets the site talk to itself, Supabase (database, sign-in, music files),
// Dropbox (Portal uploads) and Google Fonts, and stops other sites from framing or scripting it.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data: https://*.supabase.co ctrlroom-file:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.dropboxapi.com https://content.dropboxapi.com https://*.dropboxusercontent.com https://vercel.live wss://ws-us3.pusher.com ctrlroom-file:",
  "frame-src https://vercel.live",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
  poweredByHeader: false,
  // lets link previews shrink cover art (stored in Supabase) to a 1200px image
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  async redirects() {
    // the Mac app's download link (built by GitHub Actions from /mac)
    return [{ source: '/mac', destination: 'https://github.com/mixedbyac/ctrl-room/releases/download/mac-app/CTRL-ROOM.dmg', permanent: false }];
  },
};

export default nextConfig;

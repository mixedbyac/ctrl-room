// The site's public address. Always ctrl-room.app, unless NEXT_PUBLIC_SITE_URL points somewhere else on purpose
// (an old *.vercel.app value is ignored so links never go out on the Vercel address).
const env = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
export const SITE_URL = env && !/\.vercel\.app$/i.test(env) ? env : 'https://ctrl-room.app';

// The Portal's public address (where clients send files). sendfileshere.com unless NEXT_PUBLIC_PORTAL_URL points at another
// portal domain on purpose; a value pointing back at the main app or Vercel is ignored.
const penv = (process.env.NEXT_PUBLIC_PORTAL_URL || '').replace(/\/+$/, '');
export const PORTAL_URL = penv && !/ctrl-room\.app|\.vercel\.app/i.test(penv) ? penv : 'https://sendfileshere.com';

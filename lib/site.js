// The site's public address. Always ctrl-room.app, unless NEXT_PUBLIC_SITE_URL points somewhere else on purpose
// (an old *.vercel.app value is ignored so links never go out on the Vercel address).
const env = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
export const SITE_URL = env && !/\.vercel\.app$/i.test(env) ? env : 'https://ctrl-room.app';

import { createHmac, timingSafeEqual } from 'crypto';
import { SITE_URL } from '@/lib/site';

const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'ctrl-room';
const mac = (id, email, exp) => createHmac('sha256', key()).update(`confirm.${id}.${String(email).toLowerCase()}.${exp}`).digest('base64url').slice(0, 32);

/** A signed “confirm your email” link, good for 7 days. */
export function confirmLink(user) {
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  return `${SITE_URL}/api/confirm?u=${user.id}&x=${exp}&s=${mac(user.id, user.email, exp)}`;
}
export function confirmOk(user, exp, sig) {
  const want = Buffer.from(mac(user.id, user.email, exp)), got = Buffer.from(String(sig || ''));
  return want.length === got.length && timingSafeEqual(want, got);
}

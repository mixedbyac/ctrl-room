'use client';
import { api } from '@/lib/supabase';

/** Tell the server something happened so it can ping the other side's phones. Fire and forget. */
export function pingPush(ev) { try { api('/api/push', { action: 'event', ...ev }).catch(() => {}); } catch {} }

const isIOS = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
export const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
/** 'ok' | 'ios-home' (iPhone: add to Home Screen first) | 'unsupported' */
export function pushSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !standalone()) return 'ios-home';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}
const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

export async function turnOnPush(device) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked for CTRL ROOM. Turn them on in your phone or browser settings, then try again.' : 'Notifications weren’t allowed.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { key } = await api('/api/push', { action: 'key' });
  let sub = await reg.pushManager.getSubscription();
  if (sub) { try { await sub.unsubscribe(); } catch {} }
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  return api('/api/push', { action: 'subscribe', sub: sub.toJSON(), device });
}
export async function turnOffPush() {
  const reg = await navigator.serviceWorker?.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  await api('/api/push', { action: 'unsubscribe', endpoint: sub?.endpoint || null });
  try { await sub?.unsubscribe(); } catch {}
}
export async function thisDeviceOn() {
  try { const reg = await navigator.serviceWorker?.getRegistration('/sw.js'); return !!(await reg?.pushManager.getSubscription()); } catch { return false; }
}

'use client';
import { useEffect, useRef } from 'react';

// Keeps a page's data current: reloads when you come back to the window or tab, every so often while it's open,
// and right away when anything in the app says it changed something (window event 'ctrl-room:changed').
export function useLive(reload, { every = 20000 } = {}) {
  const fn = useRef(reload);
  fn.current = reload;
  useEffect(() => {
    let last = Date.now();
    const run = (force) => { if (!force && Date.now() - last < 3000) return; last = Date.now(); try { fn.current?.(); } catch {} };
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    const onFocus = () => run();
    const onChanged = () => run(true);
    const t = setInterval(() => { if (document.visibilityState === 'visible') run(); }, every);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    window.addEventListener('ctrl-room:changed', onChanged);
    let bc; try { bc = new BroadcastChannel('ctrl-room-changed'); bc.onmessage = onChanged; } catch {}
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      window.removeEventListener('ctrl-room:changed', onChanged);
      try { bc?.close(); } catch {}
    };
  }, [every]);
}

/** Tell every open page (and other tabs/windows) that something changed, so they refresh now. */
export function changed() {
  try { window.dispatchEvent(new Event('ctrl-room:changed')); } catch {}
  try { const bc = new BroadcastChannel('ctrl-room-changed'); bc.postMessage(1); bc.close(); } catch {}
}

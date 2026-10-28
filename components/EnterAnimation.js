'use client';
import { useEffect, useState } from 'react';

const KEY = 'ctrl-room:enter';
export const markEntering = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} };
// a magic-link sign-in arrives with a token in the URL: count that as entering too
if (typeof window !== 'undefined' && /access_token=|type=magiclink/.test(window.location.hash)) markEntering();

/** After signing in: the CTRL ROOM logo, then a flight in through the house's front door. */
export default function EnterAnimation({ active }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) return;
    let go = false;
    try { go = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch {}
    if (!go || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2100);
    return () => clearTimeout(t);
  }, [active]);
  if (!show) return null;
  return (
    <div className="enter" aria-hidden="true" onClick={() => setShow(false)}>
      <div className="enter-glow" />
      <div className="enter-logo"><img src="/logo.png" alt="" /><span className="enter-door" /></div>
      <p className="enter-word">CTRL ROOM</p>
    </div>
  );
}

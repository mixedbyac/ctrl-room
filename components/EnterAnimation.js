'use client';
import { useEffect, useRef, useState } from 'react';

const KEY = 'ctrl-room:enter';
export const markEntering = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} };
if (typeof window !== 'undefined' && /access_token=|type=magiclink/.test(window.location.hash)) markEntering();

/** The logo, dimmed, filling left to right as things load. done=true finishes the fill and fades out. */
export function LogoLoader({ done = false, onGone }) {
  const [p, setP] = useState(4);
  const [gone, setGone] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (done) return;
    const t0 = performance.now();
    const tick = (now) => { const s = (now - t0) / 1000; setP(4 + 86 * (1 - Math.exp(-s / 1.4))); raf.current = requestAnimationFrame(tick); }; // eases toward 90%
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [done]);
  useEffect(() => {
    if (!done) return;
    cancelAnimationFrame(raf.current);
    setP(100);
    const t = setTimeout(() => { setGone(true); onGone?.(); }, 650);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line
  if (gone) return null;
  return (
    <div className={`lload ${done ? 'out' : ''}`} role="progressbar" aria-label="Loading CTRL ROOM" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className="lload-logo">
        <img src="/logo.png" alt="" className="lload-dim" />
        <img src="/logo.png" alt="" className="lload-fill" style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }} />
      </div>
    </div>
  );
}

/** After signing in: the loader stays up until the first data is in. */
export default function EnterAnimation({ active, ready }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) return;
    let go = false;
    try { go = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch {}
    if (go) setShow(true);
  }, [active]);
  if (!show) return null;
  return <LogoLoader done={ready} onGone={() => setShow(false)} />;
}

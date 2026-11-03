'use client';
// If something breaks, show what happened (instead of a blank “Application error” page) and a way back.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en"><body style={{ margin: 0, background: '#0f0f10', color: '#f4f4f5', fontFamily: '-apple-system, system-ui, sans-serif' }}>
      <ErrorBody error={error} reset={reset} />
    </body></html>
  );
}
export function ErrorBody({ error, reset }) {
  const msg = String(error?.message || error || 'Unknown error');
  // a page left open across an update asks for files that no longer exist: just load the new version
  if (typeof window !== 'undefined' && /ChunkLoadError|Loading chunk|dynamically imported module|Loading CSS chunk/i.test(msg + (error?.name || ''))) {
    try { const k = 'cr_reloaded_for_update'; if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); window.location.reload(); return null; } } catch {}
  }
  const where = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: 'center', display: 'grid', gap: 12 }}>
        <img src="/logo.png" alt="" width="64" height="64" style={{ justifySelf: 'center', opacity: 0.8 }} />
        <b style={{ fontSize: 20 }}>Something went wrong on this page</b>
        <span style={{ color: '#8a8a92', fontSize: 14 }}>Reloading usually fixes it. If it keeps happening, send this to your engineer:</span>
        <code style={{ fontSize: 12.5, background: '#1b1b1e', padding: '10px 12px', borderRadius: 10, color: '#f5d547', wordBreak: 'break-word' }}>{where} · {msg}</code>
        <span style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => window.location.reload()} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 0, background: '#f5d547', color: '#0f0f10', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
          <a href="/" style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid #333', color: '#f4f4f5', display: 'inline-grid', placeItems: 'center', textDecoration: 'none' }}>Home</a>
        </span>
      </div>
    </div>
  );
}

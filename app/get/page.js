'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { zipFromUrls } from '@/lib/streamzip';

export default function Page() { return <Suspense fallback={null}><Get /></Suspense>; }

// Opened in the regular browser from the Mac app's Portal inbox: builds the send's zip and saves it, no sign-in needed.
function Get() {
  const t = useSearchParams().get('k');
  const [msg, setMsg] = useState('Getting the files…');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!t) { setMsg('This link is missing its key.'); return; }
    (async () => {
      try {
        const res = await fetch('/api/portal/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: t }) });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Couldn’t get the files.');
        const blob = await zipFromUrls(r.files, (ev) => setMsg(`Zipping ${ev.done} of ${ev.total}…`));
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = href; a.download = `${r.folder}.zip`; document.body.appendChild(a); a.click(); a.remove();
        setMsg(`Downloaded ${r.folder}.zip`); setDone(true);
      } catch (e) { setMsg(e.message); }
    })();
  }, [t]);
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
        <img src="/logo.png" alt="" width={48} height={48} />
        <p style={{ margin: 0, fontWeight: 700 }}>{msg}</p>
        {done && <p className="muted small" style={{ margin: 0 }}>You can close this tab.</p>}
      </div>
    </main>
  );
}

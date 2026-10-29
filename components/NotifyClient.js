'use client';
import { useState } from 'react';
import { api } from '@/lib/supabase';

/** After mixes go up: one tap to email the client (the timeline already updated on its own). */
export default function NotifyClient({ deliveries = [], className = '' }) {
  const [st, setSt] = useState('');
  const [why, setWhy] = useState('');
  const list = deliveries.filter((d) => d && d.songId);
  if (!list.length) return null;
  const body = list.length === 1
    ? `${list[0].label} is ready to listen.`
    : `New mixes are ready: ${list.map((d) => `${d.songTitle} ${d.label}`).join(', ')}.`;
  const send = async () => {
    setSt('sending'); setWhy('');
    try { const r = await api('/api/sms', { songId: list[0].songId, body }); setSt(r.sent ? 'sent' : 'failed'); if (!r.sent) setWhy(r.reason || ''); }
    catch (e) { setSt('failed'); setWhy(e.message); }
  };
  return (
    <span className={`notifyclient ${className}`}>
      {st === 'sent' ? <span className="nc-done">✓ Client emailed</span> : (
        <button type="button" className="btn small primary" onClick={send} disabled={st === 'sending'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg>
          {st === 'sending' ? 'Emailing…' : 'Email the client'}
        </button>
      )}
      {st === 'failed' && <span className="ferr small">{why || 'Didn’t go out.'}</span>}
    </span>
  );
}

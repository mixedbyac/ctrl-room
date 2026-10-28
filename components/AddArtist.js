'use client';
import { useState } from 'react';
import { api } from '@/lib/supabase';

/** Engineer: add an artist by hand and email their team an invite to join. */
export default function AddArtist({ onDone }) {
  const [f, setF] = useState({ artist: '', emails: '', phone: '', spotify: '', role: 'Admin', verify: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const go = async (e) => {
    e.preventDefault(); setErr(''); setRes(null);
    if (!f.artist.trim()) return setErr('Add the artist name.');
    setBusy(true);
    try {
      const r = await api('/api/invite', { artist: f.artist.trim(), emails: f.emails, spotify: f.spotify.trim(), role: f.role, verify: f.verify, phone: f.phone.trim() });
      setRes(r); setF((x) => ({ ...x, artist: '', emails: '', phone: '', spotify: '' })); onDone?.();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); } catch {} };
  const say = (r) => r.status === 'error' ? 'Couldn’t add' : r.status === 'existing' ? (r.sent ? 'Already has an account, added and emailed' : 'Already has an account, added to the team') : r.sent ? 'Invite emailed' : 'Not emailed yet';
  return (
    <form className="panel addartist" onSubmit={go} style={{ marginBottom: 24 }}>
      <h3>Add an artist</h3>
      <p className="muted small" style={{ margin: 0 }}>Adds them to your Artists and emails an invite. Once they join, they see that artist’s projects and can send files through the Portal.</p>
      <div className="invgrid">
        <div className="fld"><label htmlFor="aa-n">Artist name</label><input id="aa-n" value={f.artist} onChange={set('artist')} placeholder="Artist name" autoFocus /></div>
        <div className="fld"><label htmlFor="aa-r">Their access</label>
          <select id="aa-r" value={f.role} onChange={set('role')}><option value="Admin">Full access (everything but downloads)</option><option value="Artist">Artist</option><option value="Manager">Manager</option><option value="Team">Team</option></select></div>
      </div>
      <div className="fld"><label htmlFor="aa-e">Email to invite <span className="opt">add a few, separated by commas</span></label><input id="aa-e" value={f.emails} onChange={set('emails')} placeholder="artist@email.com, manager@email.com" inputMode="email" autoCapitalize="none" /></div>
      <div className="fld"><label htmlFor="aa-p">Phone <span className="opt">optional, texts them the invite link too</span></label><input id="aa-p" type="tel" value={f.phone} onChange={set('phone')} placeholder="(555) 555-5555" /></div>
      <div className="fld"><label htmlFor="aa-s">Spotify artist link <span className="opt">optional, fills in the photo and bio</span></label><input id="aa-s" value={f.spotify} onChange={set('spotify')} placeholder="https://open.spotify.com/artist/…" /></div>
      <label className="smsopt"><input type="checkbox" checked={f.verify} onChange={(e) => setF((x) => ({ ...x, verify: e.target.checked }))} /> Mark them verified, I know it’s them</label>
      {err && <p className="ferr" style={{ margin: 0 }}>{err}</p>}
      <div className="row-actions"><button className="btn primary small" disabled={busy}>{busy ? 'Adding…' : f.emails.trim() ? 'Add & send invite' : 'Add artist'}</button></div>
      {res && (
        <div className="aaresults">
          <p className="toast-inline" style={{ margin: 0 }}>{res.artist} added.{!res.email ? ' Emails aren’t set up yet, so copy each invite link and text it (see Security › Email invites).' : ''}</p>
          {res.results.map((r) => (
            <div key={r.email} className="share-link">
              <span><b>{r.email}</b> · {say(r)}{r.texted ? ' · texted' : ''}{r.verified ? ' · ✓ Verified' : ''}{r.message ? `. ${r.message}` : ''}</span>
              {r.link && <button type="button" className="btn small" onClick={() => copy(r.link)}>Copy invite link</button>}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}

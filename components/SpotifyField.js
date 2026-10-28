'use client';
import { useEffect, useRef, useState } from 'react';
import SpotifyMark from '@/components/SpotifyMark';

/** Paste a Spotify artist link: shows the artist and hands their name back (onArtist) to fill the form. */
export default function SpotifyField({ id = 'fSpotify', value, onChange, onArtist, label = 'Artist’s Spotify link' }) {
  const [card, setCard] = useState(null);
  const [state, setState] = useState('');
  const last = useRef('');
  useEffect(() => {
    const v = (value || '').trim();
    if (!/open\.spotify\.com\/(intl-[a-z-]+\/)?artist\/[A-Za-z0-9]{22}|spotify:artist:/.test(v)) { setCard(null); setState(''); last.current = ''; return; }
    if (v === last.current) return;
    last.current = v;
    setState('loading');
    const t = setTimeout(() => {
      fetch(`/api/spotify?url=${encodeURIComponent(v)}`).then((r) => r.json()).then((j) => {
        if (j.error) { setState(j.error); setCard(null); return; }
        setCard(j); setState('');
        onArtist?.(j);
      }).catch(() => setState('Couldn’t reach Spotify. You can still type the artist name.'));
    }, 350);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line
  return (
    <div className="fld">
      <label htmlFor={id}>{label} <span className="opt">optional · fills in the artist for you</span></label>
      <input id={id} type="url" inputMode="url" placeholder="https://open.spotify.com/artist/…" value={value} onChange={(e) => onChange(e.target.value)} />
      {state === 'loading' && <p className="muted small" style={{ margin: 0 }}>Looking up the artist on Spotify…</p>}
      {state && state !== 'loading' && <p className="ferr" style={{ margin: 0 }}>{state}</p>}
      {card && (
        <div className="spcard">
          {card.image ? <img src={card.image} alt="" /> : <span className="spph"><SpotifyMark /></span>}
          <div><b>{card.name}</b><span>{[card.listeners ? `${card.listeners} monthly listeners` : '', card.genres].filter(Boolean).join(' · ') || 'On Spotify'}</span>
            {card.bio && <small>{card.bio.length > 140 ? card.bio.slice(0, 140) + '…' : card.bio}</small>}</div>
          <SpotifyMark />
        </div>
      )}
    </div>
  );
}

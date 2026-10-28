'use client';
import { useState } from 'react';
import { api } from '@/lib/supabase';
import Cover from '@/components/Cover';
import SpotifyMark from '@/components/SpotifyMark';
import { hashStr } from '@/lib/art';

const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Shrink an image in the browser before upload (keeps headers sharp, files small). */
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('Couldn’t read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

export function ArtistAvatar({ name, profile, size = 120, className = 'avatar' }) {
  if (profile?.image_url) return <span className={`${className} hasimg`} style={{ backgroundImage: `url(${profile.image_url})` }} role="img" aria-label={name} />;
  return <Cover as="div" seed={hashStr(name)} size={size} className={className}>{initials(name)}</Cover>;
}

export function ArtistHero({ name, profile, canEdit, onChange, children }) {
  const [editing, setEditing] = useState(false);
  const shown = profile?.display_name || name;
  const header = profile?.header_url || profile?.image_url;
  const stats = [
    profile?.listeners ? `${profile.listeners} monthly listeners` : '',
    profile?.followers != null ? `${Number(profile.followers).toLocaleString('en-US')} followers` : '',
  ].filter(Boolean);
  return (
    <>
      <div className={`aprof ${profile?.header_url ? 'hashdr' : header ? 'blurhdr' : 'nohdr'}`}>
        {header ? <div className="aprofbg" style={{ backgroundImage: `url(${header})` }} /> : <Cover as="div" seed={hashStr(name)} size={600} className="aprofbg" />}
        <div className="aprofin">
          <ArtistAvatar name={name} profile={profile} size={360} className="avatar abig" />
          <div className="aproftext">
            <p className="eyebrow">{profile?.spotify_url ? <><SpotifyMark /> Artist on Spotify</> : 'Artist'}</p>
            <h1 className="up">{shown}</h1>
            {(stats.length > 0 || profile?.genres) && <p className="aprofmeta">{[...stats, profile?.genres].filter(Boolean).join(' · ')}</p>}
            {children}
            <div className="row-actions">
              {profile?.spotify_url && <a className="spbtn" href={profile.spotify_url} target="_blank" rel="noopener noreferrer"><SpotifyMark />Open in Spotify</a>}
              {canEdit && <button className="gear" onClick={() => setEditing(!editing)}>{editing ? 'Done' : profile ? 'Edit profile' : 'Set up artist page'}</button>}
            </div>
          </div>
        </div>
      </div>
      {canEdit && editing && <ArtistEditor name={name} profile={profile} onChange={onChange} />}
      {profile?.bio && <section className="asec abio"><h2 className="h2 up">About</h2><p>{profile.bio}</p></section>}
    </>
  );
}

function ArtistEditor({ name, profile, onChange }) {
  const [url, setUrl] = useState(profile?.spotify_url || '');
  const [dn, setDn] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const run = async (what, body) => {
    setBusy(what); setMsg('');
    try {
      const r = await api('/api/artist', { name, ...body });
      onChange(r.artist);
      if (what === 'spotify') {
        setDn(r.artist.display_name || ''); setBio(r.artist.bio || ''); setUrl(r.artist.spotify_url || url);
        setMsg(`Pulled from Spotify.${r.found && !r.found.header ? ' No header image came through, so you can upload one below.' : ''}${r.found && !r.found.bio ? ' Spotify didn’t share a bio, so add one below.' : ''}`);
      } else setMsg('Saved.');
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const upload = (kind) => (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    shrink(f, kind === 'header' ? 2000 : 900).then((dataUrl) => run(kind, { action: 'image', kind, dataUrl })).catch((er) => setMsg(er.message));
  };
  return (
    <div className="panel aedit">
      <h3>Artist page</h3>
      <div className="fld">
        <label htmlFor="ae-sp">Spotify artist link</label>
        <div className="aerow">
          <input id="ae-sp" placeholder="https://open.spotify.com/artist/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn small primary" disabled={!url.trim() || !!busy} onClick={() => run('spotify', { action: 'spotify', url })}>{busy === 'spotify' ? 'Pulling…' : 'Pull from Spotify'}</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>In Spotify, open the artist, then ••• › Share › Copy link to artist. This brings in their name, photo and listeners.</p>
      </div>
      <div className="two">
        <div className="fld"><label htmlFor="ae-n">Display name</label><input id="ae-n" value={dn} placeholder={name} onChange={(e) => setDn(e.target.value)} /></div>
        <div className="fld"><label>Images</label>
          <div className="aerow">
            <label className="btn small">{busy === 'image' ? 'Uploading…' : 'New photo'}<input type="file" accept="image/*" hidden onChange={upload('image')} /></label>
            <label className="btn small">{busy === 'header' ? 'Uploading…' : 'New header'}<input type="file" accept="image/*" hidden onChange={upload('header')} /></label>
            {profile?.header_url && <button className="btn small quiet" disabled={!!busy} onClick={() => run('clear', { action: 'clear', kind: 'header' })}>Remove header</button>}
          </div>
        </div>
      </div>
      <div className="fld"><label htmlFor="ae-b">Bio</label><textarea id="ae-b" rows={4} maxLength={1500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A few lines about the artist. It shows on their page and on share links." /></div>
      <div className="row-actions">
        <button className="btn primary small" disabled={!!busy} onClick={() => run('save', { action: 'save', display_name: dn, bio, spotify_url: url || null })}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <p className="toast-inline">{msg}</p>}
    </div>
  );
}

import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';

// Portal sends from clients wait in the Portal inbox: no project, song or "files received" shows anywhere in the app
// until the engineer clicks "Add to projects". Each song in such a send is { songId: 'h1', held: true, hold: {…} }.

export const isHeld = (up) => (up?.songs || []).some((s) => s.held);

const fmtBytes = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

/** The project name a send files under (its project's, or the one the sender asked for). */
export async function sendTitle(db, up) {
  if (up?.project_id) {
    const { data: p } = await db.from('projects').select('title').eq('id', up.project_id).maybeSingle();
    if (p?.title) return p.title;
  }
  return (up?.songs || [])[0]?.hold?.title || null;
}

/** Puts a held send on the app: makes (or adds to) the project, its songs, the timeline notes and any demo. */
export async function placeSend(db, up) {
  const entries = up.songs || [];
  const meta = entries.find((s) => s.hold)?.hold || {};
  const today = new Date().toISOString().slice(0, 10);
  let project = null;
  if (up.project_id) ({ data: project } = await db.from('projects').select('*').eq('id', up.project_id).maybeSingle());
  if (!project) {
    const { data: p, error } = await db.from('projects').insert({
      title: String(meta.title || up.artist || 'New project').slice(0, 120), artist: up.artist || meta.artist || '',
      type: ['Single', 'EP', 'Album', 'Mixtape'].includes(meta.type) ? meta.type : 'Single',
      release: meta.release || null, seed: Number(meta.seed) || Math.floor(Math.random() * 1e9),
      contact_name: up.name, client_email: up.email || null, phone: up.phone || null,
    }).select().single();
    if (error) throw new Error(error.message);
    project = p;
  } else {
    const patch = {};
    if (up.phone && !project.phone) patch.phone = up.phone;
    if (!project.contact_name && up.name && up.name !== 'Send link') patch.contact_name = up.name;
    if (Object.keys(patch).length) await db.from('projects').update(patch).eq('id', project.id);
  }

  const { data: existing } = await db.from('songs').select('id,title,position,received_at').eq('project_id', project.id);
  let pos = (existing || []).reduce((m, s) => Math.max(m, s.position), -1);
  const out = [];
  for (const s of entries) {
    if (!s.held) { out.push(s); continue; }
    const title = String(s.title || 'Song').trim().slice(0, 120);
    const info = s.info || {};
    const match = (existing || []).find((x) => x.title.toLowerCase() === title.toLowerCase());
    let songId;
    if (match) {
      songId = match.id;
      if (Object.keys(info).length) await db.from('songs').update(info).eq('id', songId);
    } else {
      const { data: row, error } = await db.from('songs').insert({ project_id: project.id, title, position: ++pos, ...info }).select('id').single();
      if (error) throw new Error(error.message);
      songId = row.id;
    }
    try {
      if (s.files) {
        await db.from('songs').update({ received_at: match?.received_at || today, files_summary: `${s.files} files · ${fmtBytes(s.bytes || 0)}` }).eq('id', songId);
        await db.from('updates').insert({ song_id: songId, from_client: true, body: `Sent ${s.files} file${s.files > 1 ? 's' : ''} (${fmtBytes(s.bytes || 0)}) through the Portal.${up.message ? ` “${up.message}”` : ''}` });
      } else {
        await db.from('updates').insert({ song_id: songId, from_client: true, body: 'Added this song. Files coming soon.' });
      }
      if (s.demo?.path) await addDemo(db, songId, s.demo);
    } catch {} // a timeline hiccup never stops the rest
    const { held, hold, demo, info: _i, ...rest } = s;
    out.push({ ...rest, songId, title });
  }

  // optional: set up the artist page from their Spotify link
  if (spotifyArtistId(meta.spotify)) {
    try {
      const { data: cur } = await db.from('artists').select('id, spotify_url').ilike('name', project.artist).maybeSingle();
      if (!cur?.spotify_url) {
        const sp = await fetchSpotifyArtist(meta.spotify);
        const row = { spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, display_name: sp.display_name, image_url: sp.image_url, header_url: sp.header_url, bio: sp.bio, listeners: sp.listeners, genres: sp.genres, followers: sp.followers, updated_at: new Date().toISOString() };
        if (cur) await db.from('artists').update(row).eq('id', cur.id); else await db.from('artists').insert({ name: project.artist, ...row });
      }
    } catch {}
  }

  const { error } = await db.from('uploads').update({ project_id: project.id, songs: out }).eq('id', up.id);
  if (error) throw new Error(error.message);
  return { projectId: project.id, songs: out };
}

const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));
async function addDemo(db, songId, d) {
  const { data: vs } = await db.from('versions').select('label').eq('song_id', songId);
  const n = (vs || []).filter(isDemo).length;
  const label = n ? `Demo ${n + 1}` : 'Demo';
  const st = d.stats || {}, info = d.info || {};
  const row = { song_id: songId, label, note: 'The starting point', storage_path: d.path, duration: st.duration ?? null, peaks: Array.isArray(st.peaks) ? st.peaks.slice(0, 1000) : null, peak_db: st.peak_db ?? null, rms_db: st.rms_db ?? null };
  const extra = { lufs: st.lufs ?? null, file_name: info.file_name ?? null, file_size: info.file_size ?? null, file_format: info.file_format ?? null, sample_rate: info.sample_rate ?? null, bit_depth: info.bit_depth ?? null, lossless: info.lossless ?? null };
  let { error } = await db.from('versions').insert({ ...row, ...extra });
  if (error && /column/i.test(error.message)) ({ error } = await db.from('versions').insert(row));
  if (!error) await db.from('updates').insert({ song_id: songId, from_client: true, body: `Sent the demo (${label}). Compare any mix to it with “Compare to demo”.` });
}

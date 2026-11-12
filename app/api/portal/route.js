import { limit } from '@/lib/ratelimit';
import { admin, userFrom, canSee, isEngineer, json, fail, setConfig } from '@/lib/server';
import { TITLES } from '@/lib/titles';
import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';

export const runtime = 'nodejs';

// Creates (or adds to) a project from the Portal setup form, before any files are sent.
export async function POST(req) {
  const slow = limit(req, 'portal', 20, 3600000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  if (!b) return fail('Missing form data.');
  let name = String(b.name || '').trim(); const email = String(b.email || '').trim().toLowerCase();
  let artist = String(b.artist || '').trim(); const phone = String(b.phone || '').trim();
  const songs = Array.isArray(b.songs) ? b.songs.filter((s) => String(s.title || '').trim()).slice(0, 40) : [];
  // a project's send link (sendfileshere.com/?to=…) is just a drop box: who sent it is optional (checked against the project below)
  const linkSend = !!(b.projectId && b.portalToken);
  if (!linkSend && (!name || !artist)) return fail('Add your name and the artist name.');
  if ((!linkSend || email) && !/^\S+@\S+\.\S+$/.test(email)) return fail('Add a valid email address.');
  if (!songs.length) return fail('Add at least one song.');

  // what the sender does (Artist, Manager…): decides their role once they make an account and confirm their email
  if (TITLES.includes(b.who)) await setConfig(`sender_title:${email}`, b.who).catch(() => {});
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline || '')) ? b.deadline : null; // client's "need it by" becomes the song's due date
  const db = admin();
  const user = await userFrom(req);
  // a send from anyone but the engineer waits in the Portal inbox: nothing lands on a project until the engineer adds it
  const engineer = !!user && (await isEngineer(user));
  let project;
  if (b.projectId) {
    const { data: p } = await db.from('projects').select('*').eq('id', b.projectId).single();
    // a project's own Portal link lets anyone with it send straight in; otherwise you need to be on the team
    const viaLink = p && b.portalToken && p.settings?.portal_token && b.portalToken === p.settings.portal_token;
    const ok = p && (viaLink || (user && (await canSee(user, p.id))));
    if (!ok) return fail('You don’t have access to that project. Ask your engineer to add you to the artist’s team.', 403);
    if (linkSend && !viaLink && (!name || !artist)) return fail('Add your name and the artist name.');
    project = p;
    if (!artist) artist = p.artist || '';
    if (!name) name = 'Send link';
    if (!engineer) return holdSend(db, { b, project, name, email, phone, artist, songs, deadline });
    const patch = {};
    if (phone && !p.phone) patch.phone = phone;
    if (!p.contact_name && name !== 'Send link') patch.contact_name = name;
    if (Object.keys(patch).length) await db.from('projects').update(patch).eq('id', p.id);
  } else {
    if (!engineer) return holdSend(db, { b, project: null, name, email, phone, artist, songs, deadline });
    const t = b.project || {};
    const fallback = songs.length === 1 ? String(songs[0].title).trim() : `${artist} – ${songs.length} songs`;
    const title = (String(t.title || '').trim() || fallback).slice(0, 120);
    const { data: p, error } = await db.from('projects').insert({
      title, artist, type: ['Single', 'EP', 'Album', 'Mixtape'].includes(t.type) ? t.type : 'Single',
      release: t.release || null, seed: Number(t.seed) || Math.floor(Math.random() * 1e9),
      contact_name: name, client_email: email, phone: phone || null,
    }).select().single();
    if (error) return fail(error.message, 500);
    project = p;
  }

  const { data: existing } = await db.from('songs').select('id,title,position').eq('project_id', project.id);
  let pos = (existing || []).reduce((m, s) => Math.max(m, s.position), -1);
  const out = [];
  for (const s of songs) {
    const title = String(s.title).trim().slice(0, 120);
    const match = (existing || []).find((x) => x.title.toLowerCase() === title.toLowerCase());
    const info = {
      ...(Number(s.bpm) ? { bpm: Number(s.bpm) } : {}),
      ...(s.key ? { musical_key: String(s.key).slice(0, 40) } : {}),
      ...(s.ref ? { reference: String(s.ref).slice(0, 500) } : {}),
      ...(s.notes ? { artist_notes: String(s.notes).slice(0, 2000) } : {}),
      ...(deadline ? { eta: deadline } : {}),
    };
    if (match) {
      if (Object.keys(info).length) await db.from('songs').update(info).eq('id', match.id);
      out.push({ songId: match.id, title: match.title });
    } else {
      const { data: row, error } = await db.from('songs').insert({ project_id: project.id, title, position: ++pos, ...info }).select('id,title').single();
      if (error) return fail(error.message, 500);
      out.push({ songId: row.id, title: row.title });
    }
  }

  const { data: up, error: upErr } = await db.from('uploads').insert({
    project_id: project.id, name, email, phone: phone || null, artist, message: [deadline ? `Needed by ${deadline}.` : '', String(b.message || '')].filter(Boolean).join(' ').slice(0, 2000),
    songs: out.map((s) => ({ ...s, files: 0, bytes: 0 })),
  }).select('id').single();
  if (upErr) return fail(upErr.message, 500);

  // optional: set up the artist page from their Spotify link (never blocks the upload)
  if (spotifyArtistId(b.spotify)) {
    try {
      const { data: cur } = await db.from('artists').select('id, spotify_url').ilike('name', artist).maybeSingle();
      if (!cur?.spotify_url) {
        const sp = await fetchSpotifyArtist(b.spotify);
        const row = { spotify_id: sp.spotify_id, spotify_url: sp.spotify_url, display_name: sp.display_name, image_url: sp.image_url, header_url: sp.header_url, bio: sp.bio, listeners: sp.listeners, genres: sp.genres, followers: sp.followers, updated_at: new Date().toISOString() };
        if (cur) await db.from('artists').update(row).eq('id', cur.id); else await db.from('artists').insert({ name: artist, ...row });
      }
    } catch {}
  }

  return json({ uploadId: up.id, projectId: project.id, projectTitle: project.title, songs: out });
}

const songInfo = (s, deadline) => ({
  ...(Number(s.bpm) ? { bpm: Number(s.bpm) } : {}),
  ...(s.key ? { musical_key: String(s.key).slice(0, 40) } : {}),
  ...(s.ref ? { reference: String(s.ref).slice(0, 500) } : {}),
  ...(s.notes ? { artist_notes: String(s.notes).slice(0, 2000) } : {}),
  ...(deadline ? { eta: deadline } : {}),
});

// Held send: only an uploads row (files still go to Dropbox). The engineer's "Add to projects" makes the project and songs.
async function holdSend(db, { b, project, name, email, phone, artist, songs, deadline }) {
  const t = b.project || {};
  const fallback = songs.length === 1 ? String(songs[0].title).trim() : `${artist} – ${songs.length} songs`;
  const title = project ? project.title : (String(t.title || '').trim() || fallback).slice(0, 120);
  const hold = {
    title, type: t.type || (songs.length <= 1 ? 'Single' : songs.length <= 6 ? 'EP' : 'Album'), release: t.release || null,
    seed: Number(t.seed) || Math.floor(Math.random() * 1e9), spotify: b.spotify ? String(b.spotify).slice(0, 300) : null,
  };
  const entries = songs.map((s, i) => ({ songId: `h${i + 1}`, title: String(s.title).trim().slice(0, 120), held: true, hold, info: songInfo(s, deadline), files: 0, bytes: 0 }));
  const { data: up, error } = await db.from('uploads').insert({
    project_id: project?.id || null, name, email: email || null, phone: phone || null, artist,
    message: [deadline ? `Needed by ${deadline}.` : '', String(b.message || '')].filter(Boolean).join(' ').slice(0, 2000),
    songs: entries,
  }).select('id').single();
  if (error) return fail(error.message, 500);
  return json({ uploadId: up.id, projectId: null, projectTitle: title, held: true, songs: entries.map((e) => ({ songId: e.songId, title: e.title })) });
}

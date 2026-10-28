import { admin, userFrom, isEngineerEmail, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

// Creates (or adds to) a project from the Portal setup form, before any files are sent.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  if (!b) return fail('Missing form data.');
  const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
  const artist = String(b.artist || '').trim(), phone = String(b.phone || '').trim();
  const songs = Array.isArray(b.songs) ? b.songs.filter((s) => String(s.title || '').trim()).slice(0, 40) : [];
  if (!name || !artist) return fail('Add your name and the artist name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Add a valid email address.');
  if (!songs.length) return fail('Add at least one song.');

  const db = admin();
  let project;
  if (b.projectId) {
    const user = await userFrom(req);
    const { data: p } = await db.from('projects').select('*').eq('id', b.projectId).single();
    const ok = p && user && ((p.client_email || '').toLowerCase() === user.email.toLowerCase() || isEngineerEmail(user.email));
    if (!ok) return fail('Sign in with the email on that project to add to it.', 403);
    project = p;
    const patch = {};
    if (phone && !p.phone) patch.phone = phone;
    if (!p.contact_name) patch.contact_name = name;
    if (Object.keys(patch).length) await db.from('projects').update(patch).eq('id', p.id);
  } else {
    const t = b.project || {};
    const title = String(t.title || '').trim();
    if (!title) return fail('Give the project a title.');
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
    project_id: project.id, name, email, phone: phone || null, artist, message: String(b.message || '').slice(0, 2000),
    songs: out.map((s) => ({ ...s, files: 0, bytes: 0 })),
  }).select('id').single();
  if (upErr) return fail(upErr.message, 500);

  return json({ uploadId: up.id, projectId: project.id, projectTitle: project.title, songs: out });
}

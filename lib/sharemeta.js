import { admin } from '@/lib/server';
import { creditLine } from '@/lib/credit';

/** A short fingerprint of what a preview shows: it changes when the cover, name or artist does, so link previews pick up the new picture. */
export function previewVer(...parts) {
  let h = 2166136261;
  for (const c of parts.map((x) => String(x ?? '')).join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** What a share link is, for link previews (iMessage, Instagram, WhatsApp…). Null if the link is off or unknown. */
export async function shareInfo(token, { light = false } = {}) {
  if (!token || String(token).length > 40) return null;
  const db = admin();
  let song = null, project = null;
  // app links (ctrl-room.app/p/<id>, /s/<id>) preview as p_<id> / s_<id>: they still need sign-in to open
  const app = /^([ps])_([0-9a-f-]{36})$/i.exec(String(token));
  if (app) {
    if (app[1] === 's') {
      ({ data: song } = await db.from('songs').select('*').eq('id', app[2]).maybeSingle());
      if (!song) return null;
      ({ data: project } = await db.from('projects').select('*').eq('id', song.project_id).single());
    } else ({ data: project } = await db.from('projects').select('*').eq('id', app[2]).maybeSingle());
    if (!project || project.archived) return null;
  } else {
    ({ data: song } = await db.from('songs').select('*').eq('share_token', token).maybeSingle());
    if (song) {
      if (song.sharing === false) return null;
      ({ data: project } = await db.from('projects').select('*').eq('id', song.project_id).single());
    } else {
      ({ data: project } = await db.from('projects').select('*').eq('share_token', token).maybeSingle());
    }
    if (!project || project.sharing === false || project.archived) return null;
  }
  const { data: art } = light ? { data: null } : await db.from('artists').select('display_name, image_url').ilike('name', project.artist).maybeSingle().then((r) => r, () => ({ data: null }));
  const own = song?.cover_path, gen = own && String(own).startsWith('gen:');
  const path = gen ? null : own || project.cover_path || null;
  let cover = null;
  if (path) { const { data } = await db.storage.from('mixes').createSignedUrl(path, 60 * 60 * 24 * 7); cover = data?.signedUrl || null; }
  let credit = '';
  if (!light) try {
    const want = String(project.settings?.engineer || '').toLowerCase();
    const { data: eps } = await db.from('engineer_profiles').select('*');
    const e = (want && (eps || []).find((x) => x.email === want)) || (eps || []).find((x) => x.is_main);
    if (e) credit = creditLine(e);
  } catch {}
  let count = 0;
  if (!song && !light) { const { count: n } = await db.from('songs').select('id', { head: true, count: 'exact' }).eq('project_id', project.id); count = n || 0; }
  return {
    kind: song ? 'song' : 'project',
    title: song ? song.title : project.title,
    project: project.title,
    artist: art?.display_name || project.artist,
    artistImage: art?.image_url || null,
    cover, coverPath: path, seed: gen ? Number(own.slice(4)) || song.seed : own ? song.seed : project.seed,
    credit, count,
    ver: previewVer(path, own, song?.title, project.title, art?.display_name || project.artist, project.seed, song?.seed),
  };
}

/** A project's file-request link (sendfileshere.com/?to=<token>): which project, and its cover. */
export async function requestInfo(token) {
  if (!token || String(token).length > 40) return null;
  const db = admin();
  const { data: project } = await db.from('projects').select('id, title, artist, seed, cover_path, archived, settings').eq('settings->>portal_token', token).maybeSingle();
  if (!project || project.archived) return null;
  let cover = null;
  if (project.cover_path) { const { data } = await db.storage.from('mixes').createSignedUrl(project.cover_path, 60 * 60 * 24); cover = data?.signedUrl || null; }
  return { title: project.title, artist: project.artist, seed: project.seed, cover, coverPath: project.cover_path, ver: previewVer(project.cover_path, project.title, project.artist, project.seed) };
}

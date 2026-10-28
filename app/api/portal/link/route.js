import { admin, json, fail, dropboxFolder, dropboxPath, dropboxUploadLink } from '@/lib/server';

export const runtime = 'nodejs';
const MAX = 150 * 1024 * 1024; // Dropbox single-request upload limit

// Hands the browser a one-time Dropbox upload link for one file.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  if (!b?.uploadId || !b?.songId || !b?.name) return fail('Missing file details.');
  if (Number(b.size) > MAX) return fail(`${b.name} is over 150 MB. Split it up or send a smaller zip.`);

  const db = admin();
  const { data: up } = await db.from('uploads').select('id,artist,project_id,songs,created_at').eq('id', b.uploadId).single();
  if (!up) return fail('Unknown send.', 404);
  if (Date.now() - new Date(up.created_at).getTime() > 24 * 3600 * 1000) return fail('This send has expired. Start a new one.', 410);
  const song = (up.songs || []).find((s) => s.songId === b.songId);
  if (!song) return fail('That song is not part of this send.', 403);
  const { data: p } = await db.from('projects').select('title').eq('id', up.project_id).single();

  try {
    const folder = dropboxFolder(up.artist, p?.title, song.title);
    const link = await dropboxUploadLink(dropboxPath(folder, b.name));
    return json({ link, folder });
  } catch (e) {
    return fail(e.message, 502);
  }
}

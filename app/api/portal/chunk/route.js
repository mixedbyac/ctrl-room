import { limit } from '@/lib/ratelimit';
import { admin, json, fail, dropboxFolder, dropboxPath, dropboxChunk } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
const PIECE = 4 * 1024 * 1024; // must stay under Vercel's 4.5 MB request limit
const MAX = 2 * 1024 * 1024 * 1024;

// Files over 150 MB: the browser sends 4 MB pieces here and we pass them to a Dropbox upload session.
// Headers: x-upload-id, x-song-id, x-name (URI-encoded), x-step (start|append|finish), x-session, x-offset, x-size
export async function POST(req) {
  const slow = limit(req, 'portal-chunk', 6000, 600000); if (slow) return slow;
  const h = (k) => req.headers.get(k) || '';
  const uploadId = h('x-upload-id'), songId = h('x-song-id'), step = h('x-step');
  const name = decodeURIComponent(h('x-name') || 'file');
  const offset = Number(h('x-offset') || 0), size = Number(h('x-size') || 0);
  if (!uploadId || !songId || !['start', 'append', 'finish'].includes(step)) return fail('Missing file details.');
  if (size > MAX) return fail(`${name} is over 2 GB.`);

  const db = admin();
  const { data: up } = await db.from('uploads').select('id,artist,project_id,songs,created_at').eq('id', uploadId).single();
  if (!up) return fail('Unknown send.', 404);
  if (Date.now() - new Date(up.created_at).getTime() > 24 * 3600 * 1000) return fail('This send has expired. Start a new one.', 410);
  const song = (up.songs || []).find((s) => s.songId === songId);
  if (!song) return fail('That song is not part of this send.', 403);

  const data = Buffer.from(await req.arrayBuffer());
  if (data.length > PIECE) return fail('Piece too big.', 413);
  try {
    if (step === 'start') {
      const r = await dropboxChunk('start', { data });
      return json({ session: r.session_id });
    }
    const session = h('x-session');
    if (!session) return fail('Missing upload session.');
    if (step === 'append') {
      try { await dropboxChunk('append', { session, offset, data }); }
      catch (e) { if (!/incorrect_offset/.test(e.message)) throw e; } // a retry of a piece that already arrived
      return json({ ok: true });
    }
    const { data: p } = await db.from('projects').select('title').eq('id', up.project_id).single();
    const folder = await dropboxFolder(up.artist, p?.title, song.title);
    const r = await dropboxChunk('finish', { session, offset, path: dropboxPath(folder, name), data });
    return json({ ok: true, path: r.path_display });
  } catch (e) {
    return fail(e.message, 502);
  }
}

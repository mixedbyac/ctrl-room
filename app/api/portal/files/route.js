import { admin, engineerFrom, dropboxApi, dropboxFolder, json, fail, signDownload, verifyDownload } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Engineer only: every file in a Portal send, with a short-lived download link for each (4 hours).
// Paths keep the song folder and any sub-folders, so the download can rebuild the same layout.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  // a ticket from the app (opened in the regular browser) stands in for signing in, for that one send
  const ticketId = b.ticket ? verifyDownload(b.ticket) : null;
  if (b.ticket && !ticketId) return fail('This download link expired. Click Download in CTRL ROOM again.', 403);
  if (!ticketId) {
    const { user, why } = await engineerFrom(req);
    if (!user) return fail(why || 'Engineers only.', 403);
    if (b.ticketFor) return json({ ticket: signDownload(b.ticketFor) });
    if (Array.isArray(b.ticketsFor)) return json({ tickets: Object.fromEntries(b.ticketsFor.slice(0, 200).map((id) => [id, signDownload(id, 12 * 60)])) });
  }
  if (ticketId) b.uploadId = ticketId;
  if (!b.uploadId) return fail('Missing send.');
  const db = admin();
  const { data: up } = await db.from('uploads').select('id, artist, created_at, songs, projects(title)').eq('id', b.uploadId).single();
  if (!up) return fail('Unknown send.', 404);
  const out = [];
  const songs = (up.songs || []).filter((s) => s.files);
  try {
    for (const s of songs) {
      const folder = s.folder || (await dropboxFolder(up.artist, up.projects?.title, s.title, up.created_at));
      const songDir = folder.split('/').pop();
      let r = await dropboxApi('files/list_folder', { path: folder, recursive: true, limit: 2000 });
      const entries = [...r.entries];
      while (r.has_more) { r = await dropboxApi('files/list_folder/continue', { cursor: r.cursor }); entries.push(...r.entries); }
      const files = entries.filter((e) => e['.tag'] === 'file');
      // links in small batches (Dropbox rate-limits bursts)
      for (let i = 0; i < files.length; i += 8) {
        const got = await Promise.all(files.slice(i, i + 8).map(async (f) => {
          const t = await dropboxApi('files/get_temporary_link', { path: f.path_lower });
          const rel = f.path_display.slice(folder.length).replace(/^\/+/, '');
          return { url: t.link, path: `${songs.length > 1 ? songDir + '/' : ''}${rel}`, size: f.size };
        }));
        out.push(...got);
      }
    }
  } catch (e) { return fail(e.message, 502); }
  if (!out.length) return fail('No files found in Dropbox for this send.', 404);
  const clean = (x) => String(x || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  const name = songs.length === 1
    ? clean((s => s.folder ? s.folder.split('/').pop() : `${s.title}`)(songs[0])) // "Song (2026-11-03)"
    : clean(`${up.projects?.title || 'Files'} (${new Date(up.created_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })})`);
  return json({ folder: `${clean(up.artist) || 'Files'} - ${name}`, files: out });
}

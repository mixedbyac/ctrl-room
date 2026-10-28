import { admin, json, fail, sendText, dropboxFolder } from '@/lib/server';

export const runtime = 'nodejs';

const fmtBytes = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

// Called when the browser finishes sending files: updates each song's progress.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  if (!b?.uploadId || !Array.isArray(b.results)) return fail('Missing results.');
  const db = admin();
  const { data: up } = await db.from('uploads').select('*').eq('id', b.uploadId).single();
  if (!up) return fail('Unknown send.', 404);
  const { data: p } = await db.from('projects').select('title').eq('id', up.project_id).single();
  const today = new Date().toISOString().slice(0, 10);

  const songs = await Promise.all((up.songs || []).map(async (s) => {
    const r = b.results.find((x) => x.songId === s.songId) || {};
    return { ...s, files: Number(r.files) || 0, bytes: Number(r.bytes) || 0, folder: await dropboxFolder(up.artist, p?.title, s.title) };
  }));
  await db.from('uploads').update({ songs }).eq('id', up.id);

  let total = 0;
  for (const s of songs) {
    total += s.files;
    if (s.files) {
      const { data: song } = await db.from('songs').select('received_at').eq('id', s.songId).single();
      await db.from('songs').update({ received_at: song?.received_at || today, files_summary: `${s.files} files · ${fmtBytes(s.bytes)}` }).eq('id', s.songId);
      await db.from('updates').insert({ song_id: s.songId, from_client: true, body: `Sent ${s.files} file${s.files > 1 ? 's' : ''} (${fmtBytes(s.bytes)}) through the Portal.${up.message ? ` “${up.message}”` : ''}` });
    } else {
      await db.from('updates').insert({ song_id: s.songId, from_client: true, body: 'Added this song. Files coming soon.' });
    }
  }

  if (process.env.ENGINEER_PHONE && total) {
    await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: ${up.name} (${up.artist}) sent ${total} file${total > 1 ? 's' : ''} for ${p?.title}.`);
  }
  return json({ ok: true });
}

'use client';
import { supabase } from '@/lib/supabase';
import { analyseFile } from '@/lib/audio';
import { readFileInfo } from '@/lib/fileinfo';

/** Uploads a file as the song's Demo (the baseline). Pass uploadId for Portal sends, otherwise the signed-in user is used. */
export async function uploadDemo({ songId, file, uploadId = null, onStatus = () => {} }) {
  const { data: sess } = await supabase().auth.getSession();
  const headers = { 'Content-Type': 'application/json', ...(sess.session && !uploadId ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) };
  const call = async (body) => {
    const r = await fetch('/api/demo', { method: 'POST', headers, body: JSON.stringify({ songId, uploadId, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Couldn’t add the demo (${r.status}).`);
    return j;
  };
  onStatus('Reading the demo…');
  let stats = {}; try { stats = await analyseFile(file); } catch {}
  const info = await readFileInfo(file);
  const { path, token } = await call({ step: 'start', name: file.name });
  onStatus('Uploading the demo…');
  const { error } = await supabase().storage.from('mixes').uploadToSignedUrl(path, token, file, { contentType: file.type || 'audio/wav' });
  if (error) throw new Error(/size|large|maximum/i.test(error.message) ? 'That demo is too big to play in CTRL ROOM. Try an MP3 or a file under 50 MB.' : error.message);
  return call({ step: 'done', path, stats, info });
}

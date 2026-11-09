'use client';
import { supabase } from '@/lib/supabase';
import { analyseFile } from '@/lib/audio';
import { readFileInfo } from '@/lib/fileinfo';
import { uploadWithProgress } from '@/lib/upload';

/** Uploads a file as the song's Demo (the baseline). Pass uploadId for Portal sends, otherwise the signed-in user is used. */
export async function uploadDemo({ songId, file, uploadId = null, onStatus = () => {}, onProgress = () => {} }) {
  const { data: sess } = await supabase().auth.getSession();
  const headers = { 'Content-Type': 'application/json', ...(sess.session && !uploadId ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) };
  const call = async (body) => {
    const r = await fetch('/api/demo', { method: 'POST', headers, body: JSON.stringify({ songId, uploadId, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Couldn’t add the demo (${r.status}).`);
    return j;
  };
  onStatus('Uploading the demo…');
  // upload and read it at the same time
  const sent = call({ step: 'start', name: file.name }).then(async ({ path, token }) => {
    const r = await uploadWithProgress({ path, token, file, onProgress });
    return { path, error: r.error };
  });
  const [{ path, error }, stats, info] = await Promise.all([sent, analyseFile(file).catch(() => ({})), readFileInfo(file).catch(() => ({}))]);
  if (error) throw new Error(/size|large|maximum/i.test(error.message) ? `That demo is over your storage’s per-file limit. Raise it in Supabase › Storage › Settings, or send an MP3.` : error.message);
  return call({ step: 'done', path, stats, info });
}

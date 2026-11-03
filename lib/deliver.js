'use client';
import { supabase, api } from '@/lib/supabase';
import { analyseFile } from '@/lib/audio';
import { nextLabel, todayISO } from '@/lib/format';
import { parseMixName, pickLabel } from '@/lib/filename';
import { readFileInfo } from '@/lib/fileinfo';

/**
 * Uploads one mix file as a new version of a song.
 * The version label comes from the file name ("Mix 2" -> v2) when it's free, otherwise the next number.
 */
export async function deliverFile({ song, versions, file, project, text = true, onStatus = () => {} }) {
  const sb = supabase();
  const parsed = parseMixName(file.name, { artist: project?.artist, project: project?.title });
  const label = pickLabel(parsed.label, versions, nextLabel);

  // upload and read the file at the same time (reading a long WAV for the waveform and loudness takes a few seconds)
  onStatus(`Uploading ${label}…`);
  const safe = file.name.replace(/[^\w.\- ]+/g, '_');
  const path = `${song.project_id}/${song.id}/${Date.now()}-${safe}`;
  const upP = sb.storage.from('mixes').upload(path, file, { contentType: file.type || 'audio/wav', upsert: false });
  const [up, stats, info] = await Promise.all([
    upP,
    analyseFile(file).catch(() => ({})),
    readFileInfo(file).catch(() => ({})),
  ]);
  const upErr = up?.error;
  if (upErr) {
    const mb = Math.round(file.size / 1e6);
    if (/size|large|maximum|413|payload/i.test(upErr.message || '') || /413/.test(String(upErr.statusCode || '')))
      throw new Error(`${file.name} is ${mb} MB, over your storage’s per-file limit. Raise it in Supabase › Storage › Settings (“Upload file size limit”; the free plan caps it at 50 MB), or bounce a smaller WAV (24-bit / 44.1 kHz) or a FLAC.`);
    throw new Error(`${file.name} didn’t upload: ${upErr.message}`);
  }

  const { bpm: dBpm, key: dKey, ...measured } = stats; // tempo and key belong to the song
  const row = { song_id: song.id, label, note: parsed.note || null, storage_path: path, ...measured };
  let { data: made, error: vErr } = await sb.from('versions').insert({ ...row, ...info }).select('id').single();
  if (vErr && /column/i.test(vErr.message)) ({ data: made, error: vErr } = await sb.from('versions').insert({ ...row, ...info, lufs: undefined }).select('id').single()); // loudness column not added yet
  if (vErr && /column/i.test(vErr.message)) { const { lufs, ...old } = row; ({ data: made, error: vErr } = await sb.from('versions').insert(old).select('id').single()); } // database not updated yet
  if (vErr) throw new Error(vErr.message);
  // the newest upload becomes the active version (top of the list, what plays first)
  if (made?.id) {
    await sb.from('songs').update({ active_version: made.id }).eq('id', song.id).then(() => {}, () => {});
    await sb.from('versions').update({ position: null }).eq('song_id', song.id).then(() => {}, () => {}); // fresh order: newest first
  }

  const today = todayISO();
  await sb.from('songs').update({
    ...(!song.bpm && dBpm ? { bpm: dBpm } : {}), ...(!song.musical_key && dKey ? { musical_key: dKey } : {}),
    status: 'review', eta: null, approved_version: null, approved_at: null,
    mixing_at: song.mixing_at || today, downloaded_at: song.downloaded_at || today, received_at: song.received_at || today,
  }).eq('id', song.id);

  const body = `${label}${parsed.note ? ` (${parsed.note})` : ''} is ready to listen.`;
  let texted = false;
  if (text) { try { texted = (await api('/api/sms', { songId: song.id, body })).sent; } catch {} }
  await sb.from('updates').insert({ song_id: song.id, body, texted });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ctrl-room:versions', { detail: { songId: song.id, activeId: made?.id || null } }));
  return { label, texted, parsed, info, id: made?.id || null };
}

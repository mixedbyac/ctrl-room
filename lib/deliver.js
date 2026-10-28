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

  onStatus(`Reading ${file.name}…`);
  let stats = {};
  try { stats = await analyseFile(file); } catch { stats = {}; }
  const info = await readFileInfo(file);

  onStatus(`Uploading ${label}…`);
  const safe = file.name.replace(/[^\w.\- ]+/g, '_');
  const path = `${song.project_id}/${song.id}/${Date.now()}-${safe}`;
  const { error: upErr } = await sb.storage.from('mixes').upload(path, file, { contentType: file.type || 'audio/wav', upsert: false });
  if (upErr) throw new Error(upErr.message);

  const row = { song_id: song.id, label, note: parsed.note || null, storage_path: path, ...stats };
  let { error: vErr } = await sb.from('versions').insert({ ...row, ...info });
  if (vErr && /column/i.test(vErr.message)) ({ error: vErr } = await sb.from('versions').insert(row)); // database not updated yet
  if (vErr) throw new Error(vErr.message);

  const today = todayISO();
  await sb.from('songs').update({
    status: 'review', eta: null, approved_version: null, approved_at: null,
    mixing_at: song.mixing_at || today, downloaded_at: song.downloaded_at || today, received_at: song.received_at || today,
  }).eq('id', song.id);

  const body = `${label}${parsed.note ? ` (${parsed.note})` : ''} is ready to listen.`;
  let texted = false;
  if (text) { try { texted = (await api('/api/sms', { songId: song.id, body })).sent; } catch {} }
  await sb.from('updates').insert({ song_id: song.id, body, texted });
  return { label, texted, parsed, info };
}

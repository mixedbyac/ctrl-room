'use client';
import { supabase } from '@/lib/supabase';
import { analyseFile } from '@/lib/audio';
import { readFileInfo } from '@/lib/fileinfo';

/** Versions that haven't been fully measured yet (uploaded before LUFS/format/tempo detection). */
export const needsMeasure = (v) => !!v?.storage_path && (v.lufs == null || v.duration == null || !v.sample_rate);

/**
 * Reads one stored mix and saves LUFS, peak, length and format on the version,
 * plus BPM and key on the song if they're empty. Nothing about the file changes.
 */
export async function measureVersion(v, song) {
  const sb = supabase();
  const { data: u } = await sb.storage.from('mixes').createSignedUrl(v.storage_path, 600);
  if (!u?.signedUrl) return false;
  const blob = await (await fetch(u.signedUrl)).blob();
  const file = new File([blob], v.file_name || v.storage_path.split('/').pop().replace(/^\d+-/, ''), { type: blob.type });
  const [st, info] = await Promise.all([analyseFile(file), readFileInfo(file)]);
  const patch = { lufs: st.lufs, peak_db: st.peak_db, rms_db: st.rms_db, duration: v.duration ?? st.duration };
  if (!v.peaks) patch.peaks = st.peaks;
  if (!v.sample_rate) Object.assign(patch, { file_format: info.file_format, sample_rate: info.sample_rate, bit_depth: info.bit_depth, file_size: info.file_size, lossless: info.lossless, file_name: v.file_name || info.file_name });
  let { error } = await sb.from('versions').update(patch).eq('id', v.id);
  if (error && /lufs/.test(error.message)) { const { lufs, ...rest } = patch; ({ error } = await sb.from('versions').update(rest).eq('id', v.id)); }
  if (song && (!song.bpm || !song.musical_key)) {
    const sp = {};
    if (!song.bpm && st.bpm) sp.bpm = st.bpm;
    if (!song.musical_key && st.key) sp.musical_key = st.key;
    if (Object.keys(sp).length) { await sb.from('songs').update(sp).eq('id', song.id); Object.assign(song, sp); }
  }
  return !error;
}

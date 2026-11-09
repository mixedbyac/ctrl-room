'use client';
import { supabase } from '@/lib/supabase';

// A song that only holds Portal files (no mix, no demo) sometimes sits next to the real song with the same name
// (files came in before the mix and landed in their own row). They then disagree: one says "Mixing", the other
// "Changes requested". This folds the files-only one into the real one: its dates, updates, notes and plays move
// over, then the empty row goes. Engineer only. Returns how many were merged.
const norm = (t) => String(t || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, '');
const done = new Set();
export async function mergeDuplicateSongs(projects) {
  const sb = supabase();
  let merged = 0;
  for (const p of projects || []) {
    const songs = p.songs || [];
    for (const src of songs) {
      if ((src.versions || []).length || done.has(src.id)) continue;
      const target = songs.find((t) => t.id !== src.id && (t.versions || []).length && norm(t.title) === norm(src.title));
      if (!target) continue;
      done.add(src.id);
      const patch = {};
      for (const k of ['received_at', 'downloaded_at', 'mixing_at']) if (!target[k] && src[k]) patch[k] = src[k];
      if (!target.eta && src.eta && target.status !== 'approved') patch.eta = src.eta;
      try {
        if (Object.keys(patch).length) await sb.from('songs').update(patch).eq('id', target.id);
        await sb.from('updates').update({ song_id: target.id }).eq('song_id', src.id);
        await sb.from('notes').update({ song_id: target.id }).eq('song_id', src.id);
        await sb.from('plays').update({ song_id: target.id }).eq('song_id', src.id).then(() => {}, () => {});
        const { error } = await sb.from('songs').delete().eq('id', src.id);
        if (!error) merged++;
      } catch { /* leave it; try again next time */ done.delete(src.id); }
    }
  }
  return merged;
}

import { limit } from '@/lib/ratelimit';
import { admin, userFrom, canSee, isEngineer, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

const isDemo = (v) => /^demo\b/i.test(String(v?.label || ''));

// Adds a demo (the baseline mixes get compared to). Works for the engineer, signed-in clients,
// and Portal sends (authorised by the send's id). body: { step: 'start' | 'done', songId, name?, path?, stats?, info?, uploadId? }
export async function POST(req) {
  const slow = limit(req, 'demo', 60, 600000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  if (!b?.songId || !['start', 'done'].includes(b.step)) return fail('Missing details.');
  const db = admin();
  const { data: song } = await db.from('songs').select('id, project_id, title').eq('id', b.songId).maybeSingle();
  if (!song) return fail('Unknown song.', 404);

  let who = 'client', ok = false;
  if (b.uploadId) {
    const { data: up } = await db.from('uploads').select('id, songs, created_at, project_id').eq('id', b.uploadId).maybeSingle();
    ok = !!up && up.project_id === song.project_id && (up.songs || []).some((s) => s.songId === song.id) && Date.now() - new Date(up.created_at).getTime() < 24 * 3600 * 1000;
  } else {
    const user = await userFrom(req);
    ok = !!user && (await canSee(user, song.project_id));
    if (ok && (await isEngineer(user))) who = 'engineer';
  }
  if (!ok) return fail('You don’t have access to this song.', 403);

  if (b.step === 'start') {
    const safe = String(b.name || 'demo').replace(/[^\w.\- ]+/g, '_').slice(-80);
    const path = `${song.project_id}/${song.id}/demo-${Date.now()}-${safe}`;
    const { data, error } = await db.storage.from('mixes').createSignedUploadUrl(path);
    if (error) return fail(error.message, 500);
    return json({ path, token: data.token });
  }

  // done: the file is in storage, add it as the demo version
  if (!String(b.path || '').startsWith(`${song.project_id}/${song.id}/demo-`)) return fail('That file isn’t part of this song.', 400);
  const { data: vs } = await db.from('versions').select('label').eq('song_id', song.id);
  const n = (vs || []).filter(isDemo).length;
  const label = n ? `Demo ${n + 1}` : 'Demo';
  const st = b.stats || {}, info = b.info || {};
  const row = {
    song_id: song.id, label, note: 'The starting point', storage_path: b.path,
    duration: st.duration ?? null, peaks: Array.isArray(st.peaks) ? st.peaks.slice(0, 1000) : null, peak_db: st.peak_db ?? null, rms_db: st.rms_db ?? null,
  };
  const extra = { lufs: st.lufs ?? null, file_name: info.file_name ?? null, file_size: info.file_size ?? null, file_format: info.file_format ?? null, sample_rate: info.sample_rate ?? null, bit_depth: info.bit_depth ?? null, lossless: info.lossless ?? null };
  let { data: v, error } = await db.from('versions').insert({ ...row, ...extra }).select('id,label').single();
  if (error && /column/i.test(error.message)) ({ data: v, error } = await db.from('versions').insert(row).select('id,label').single());
  if (error) return fail(error.message, 500);
  await db.from('updates').insert({ song_id: song.id, body: `${who === 'engineer' ? 'Added' : 'Sent'} the demo (${label}). Compare any mix to it with “Compare to demo”.`, ...(who === 'client' ? { from_client: true } : {}) });
  return json({ id: v.id, label: v.label });
}

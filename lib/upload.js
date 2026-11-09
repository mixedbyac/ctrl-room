'use client';
import { supabase } from '@/lib/supabase';

/**
 * Uploads a file to Supabase Storage and reports progress: onProgress({ pct, sent, total, speed, left }).
 * Either as the signed-in user (bucket + path) or with a signed upload token (from the server).
 */
export async function uploadWithProgress({ bucket = 'mixes', path, file, token = null, onProgress = () => {} }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const enc = path.split('/').map(encodeURIComponent).join('/');
  let url, method, auth;
  if (token) { url = `${base}/storage/v1/object/upload/sign/${bucket}/${enc}?token=${encodeURIComponent(token)}`; method = 'PUT'; auth = anon; }
  else { const { data } = await supabase().auth.getSession(); url = `${base}/storage/v1/object/${bucket}/${enc}`; method = 'POST'; auth = data.session?.access_token || anon; }
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.setRequestHeader('Authorization', `Bearer ${auth}`);
    x.setRequestHeader('apikey', anon);
    x.setRequestHeader('x-upsert', 'false');
    x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    x.setRequestHeader('cache-control', 'max-age=3600');
    const t0 = performance.now(); let lastT = t0, lastB = 0, speed = 0;
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = performance.now(), dt = (now - lastT) / 1000;
      if (dt > 0.4) { const inst = (e.loaded - lastB) / dt; speed = speed ? speed * 0.7 + inst * 0.3 : inst; lastT = now; lastB = e.loaded; }
      onProgress({ pct: e.loaded / e.total, sent: e.loaded, total: e.total, speed, left: speed ? (e.total - e.loaded) / speed : null });
    };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) { onProgress({ pct: 1, sent: file.size, total: file.size, speed, left: 0 }); resolve({ error: null }); return; }
      let msg = `Upload failed (${x.status}).`; try { const j = JSON.parse(x.responseText); msg = j.message || j.error || msg; } catch {}
      resolve({ error: { message: msg, statusCode: x.status } });
    };
    x.onerror = () => resolve({ error: { message: 'The connection dropped during the upload. Try again.' } });
    x.send(file);
  });
}

export const fmtSpeed = (bps) => (!bps ? '' : bps > 1e6 ? `${(bps / 1e6).toFixed(1)} MB/s` : `${Math.round(bps / 1e3)} KB/s`);
export const fmtLeft = (s) => (s == null || !isFinite(s) ? '' : s < 60 ? `${Math.max(1, Math.round(s))}s left` : `${Math.round(s / 60)} min left`);

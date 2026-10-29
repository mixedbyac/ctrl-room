import { admin, engineerFrom, isOwner, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
const SQL = 'Engineer profiles need a quick database update: run supabase/019_engineer_profiles.sql in Supabase.';
const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function grab(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' }).catch(() => null);
  const type = r?.headers.get('content-type') || '';
  if (!r || !r.ok || !/^image\//.test(type)) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length > 500 ? { buf, type: type.split(';')[0] } : null;
}
/** A public Instagram account's profile picture, trying a few routes (Instagram blocks some servers). */
async function instagramPicture(handle) {
  // 1) Instagram's own web profile data
  try {
    const r = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, { headers: { 'User-Agent': UA, 'x-ig-app-id': '936619743392459', Accept: 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const u = j?.data?.user?.profile_pic_url_hd || j?.data?.user?.profile_pic_url;
      if (u) { const img = await grab(u); if (img) return img; }
    }
  } catch {}
  // 2) the profile page's preview image
  try {
    const html = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US' } }).then((r) => (r.ok ? r.text() : ''));
    const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]+property="og:image"/i);
    if (m) { const img = await grab(m[1].replace(/&amp;/g, '&')); if (img) return img; }
  } catch {}
  // 3) unavatar (a public avatar service)
  return grab(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`);
}

// Engineer profile. { action: 'get' } your own · { action: 'save', full_name, display_name, credit, roles, bio, photo_url }
export async function POST(req) {
  const { user, why } = await engineerFrom(req);
  if (!user) return fail(why, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const email = user.email.toLowerCase();
  // the blue check: their email is proven (signed in through email or confirmed) and nothing is waiting on verification
  const verified = !!user.email_confirmed_at && !user.app_metadata?.needs_verify;
  const main = await isOwner(user.email);
  if (b.action === 'photo' || b.action === 'instagram') {
    let url;
    if (b.action === 'photo') {
      const m = String(b.dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) return fail('Upload a JPG, PNG or WebP image.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 4 * 1024 * 1024) return fail('That image is too big. Try one under 4 MB.');
      const path = `engineers/${email.replace(/[^a-z0-9]+/g, '-')}/photo-${Date.now()}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`;
      const up = await db.storage.from('art').upload(path, buf, { contentType: m[1], upsert: true });
      if (up.error) return fail(up.error.message, 500);
      url = db.storage.from('art').getPublicUrl(path).data.publicUrl;
    } else {
      const handle = String(b.handle || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
      if (!/^[a-z0-9._]{1,30}$/i.test(handle)) return fail('That doesn’t look like an Instagram username.');
      // grab the public profile picture and keep our own copy (Instagram's picture links expire)
      const img = await instagramPicture(handle);
      if (!img) return fail('Instagram didn’t hand over the picture right now (it often blocks automatic requests). Upload a photo instead, or try again in a bit.');
      const ext = /png/.test(img.type) ? 'png' : /webp/.test(img.type) ? 'webp' : 'jpg';
      const path = `engineers/${email.replace(/[^a-z0-9]+/g, '-')}/instagram-${Date.now()}.${ext}`;
      const up = await db.storage.from('art').upload(path, img.buf, { contentType: img.type, upsert: true });
      if (up.error) return fail(up.error.message, 500);
      url = db.storage.from('art').getPublicUrl(path).data.publicUrl;
      b.instagram = handle;
    }
    const { data: cur } = await db.from('engineer_profiles').select('*').eq('email', email).maybeSingle();
    const row = { ...(cur || { email, roles: ['mix'] }), email, photo_url: url, verified, is_main: main, updated_at: new Date().toISOString(), ...(b.instagram ? { instagram: b.instagram } : {}) };
    let { data, error } = await db.from('engineer_profiles').upsert(row).select('*').single();
    if (error && /instagram/.test(error.message)) { delete row.instagram; ({ data, error } = await db.from('engineer_profiles').upsert(row).select('*').single()); }
    if (error) return fail(/engineer_profiles/.test(error.message) ? SQL : error.message, 500);
    return json({ profile: data });
  }
  if (b.action === 'save') {
    const row = {
      email, full_name: clean(b.full_name, 100), display_name: clean(b.display_name, 60), credit: clean(b.credit, 120),
      roles: (Array.isArray(b.roles) ? b.roles : []).filter((r) => ['mix', 'master', 'record', 'produce'].includes(r)),
      bio: clean(b.bio, 600), photo_url: clean(b.photo_url, 500), verified, is_main: main, updated_at: new Date().toISOString(),
    };
    const { data, error } = await db.from('engineer_profiles').upsert(row).select('*').single();
    if (error) return fail(/engineer_profiles/.test(error.message) ? SQL : error.message, 500);
    await db.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), name: row.full_name || user.user_metadata?.name } }).catch(() => {});
    return json({ profile: data });
  }
  const { data, error } = await db.from('engineer_profiles').select('*').eq('email', email).maybeSingle();
  if (error) return fail(/engineer_profiles/.test(error.message) ? SQL : error.message, 500);
  // keep the check and main flag fresh
  if (data && (data.verified !== verified || data.is_main !== main)) await db.from('engineer_profiles').update({ verified, is_main: main }).eq('email', email);
  return json({ profile: data ? { ...data, verified, is_main: main } : { email, full_name: user.user_metadata?.name || '', roles: ['mix'], verified, is_main: main }, verified });
}

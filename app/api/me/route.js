import { admin, userFrom, json, fail } from '@/lib/server';

export const runtime = 'nodejs';

// Your own account: display name, full name, photo. { action: 'save', name, display_name } | { action: 'photo', dataUrl } | { action: 'clear-photo' }
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const meta = { ...(user.user_metadata || {}) };
  if (b.action === 'photo') {
    const m = String(b.dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!m) return fail('Upload a JPG, PNG or WebP image.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) return fail('That image is too big. Try one under 4 MB.');
    const path = `people/${user.id}/photo-${Date.now()}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`;
    const up = await db.storage.from('art').upload(path, buf, { contentType: m[1], upsert: true });
    if (up.error) return fail(up.error.message, 500);
    meta.avatar_url = db.storage.from('art').getPublicUrl(path).data.publicUrl;
  } else if (b.action === 'clear-photo') {
    delete meta.avatar_url;
  } else if (b.action === 'save') {
    meta.name = String(b.name || '').trim().slice(0, 100) || meta.name || null;
    meta.display_name = String(b.display_name || '').trim().slice(0, 60) || null;
  } else return fail('Unknown action.');
  const { data, error } = await db.auth.admin.updateUserById(user.id, { user_metadata: meta });
  if (error) return fail(error.message, 500);
  return json({ user_metadata: data.user.user_metadata });
}

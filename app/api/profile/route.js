import { admin, engineerFrom, isOwner, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
const SQL = 'Engineer profiles need a quick database update: run supabase/019_engineer_profiles.sql in Supabase.';
const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

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

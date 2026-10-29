import { limit } from '@/lib/ratelimit';
import { admin, getConfig, setConfig, dropboxToken, sendText } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Daily check (Vercel Cron, see vercel.json): database, music storage, Dropbox, texting.
// Saves the result for the Security page and texts the engineer if something broke. It also keeps
// the free Supabase project from going to sleep after a quiet week.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ua = req.headers.get('user-agent') || '';
  const isCron = secret ? auth === `Bearer ${secret}` : /vercel-cron/i.test(ua);
  if (!isCron) { const slow = limit(req, 'health', 20, 600_000); if (slow) return slow; }
  const db = admin();
  const checks = [];
  const run = async (name, fn) => {
    const t = Date.now();
    try { const note = await fn(); checks.push({ name, ok: true, ms: Date.now() - t, note: note || '' }); }
    catch (e) { checks.push({ name, ok: false, ms: Date.now() - t, note: String(e?.message || e).slice(0, 200) }); }
  };
  await run('Database', async () => { const { error } = await db.from('projects').select('id', { head: true, count: 'exact' }); if (error) throw error; });
  await run('Music storage', async () => { const { error } = await db.storage.from('mixes').list('', { limit: 1 }); if (error) throw error; });
  await run('Sign-in service', async () => { const { error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 }); if (error) throw error; });
  await run('Dropbox', async () => {
    if (!process.env.DROPBOX_APP_KEY) return 'not set up';
    if (!(await getConfig('dropbox_refresh_token')) && !process.env.DROPBOX_REFRESH_TOKEN) return 'not connected';
    await dropboxToken();
  });
  await run('Texting', async () => (process.env.TWILIO_ACCOUNT_SID ? '' : 'not set up'));
  const ok = checks.every((c) => c.ok);
  const result = { ok, at: new Date().toISOString(), checks, build: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' };

  if (isCron) {
    const prev = JSON.parse((await getConfig('health')) || 'null');
    await setConfig('health', JSON.stringify(result)).catch(() => {});
    if (!ok && (prev?.ok !== false) && process.env.ENGINEER_PHONE) {
      const bad = checks.filter((c) => !c.ok).map((c) => c.name).join(', ');
      await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM daily check: ${bad} not working. Open CTRL ROOM › Security for details.`).catch(() => {});
    }
  }
  // ?counts=1 : how much is in the database (numbers only) and which Supabase project the site uses
  if (new URL(req.url).searchParams.get('counts')) {
    const count = async (t) => { const { count: n, error } = await db.from(t).select('id', { head: true, count: 'exact' }); return error ? `error: ${error.message}` : n; };
    const { data: eng } = await db.from('app_config').select('value').eq('key', 'engineer_email').maybeSingle();
    const mask = (e) => (e ? e.replace(/^(.).*(@.*)$/, '$1…$2') : 'not set');
    return Response.json({
      supabase_project: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https:\/\/|\.supabase\.co.*$/g, ''),
      projects: await count('projects'), songs: await count('songs'), versions: await count('versions'),
      engineer: mask(eng?.value),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // public callers only learn up/down, never details
  return Response.json(isCron ? result : { ok, at: result.at }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}

// Engineer's Security page: last daily result (POST so it needs a signed-in engineer)
export async function POST(req) {
  const { userFrom, isEngineer } = await import('@/lib/server');
  const user = await userFrom(req);
  if (!user || !(await isEngineer(user))) return Response.json({ error: 'Only the engineer can see this.' }, { status: 403 });
  const last = JSON.parse((await getConfig('health')) || 'null');
  return Response.json({ last });
}

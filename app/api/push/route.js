import { limit } from '@/lib/ratelimit';
import { admin, userFrom, isEngineer, canSee, json, fail } from '@/lib/server';
import { vapidKeys, saveSub, removeSub, subsFor, pushTo } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function engineerEmails(db) {
  const { data } = await db.from('app_config').select('key, value').like('key', 'engineer_email%');
  return [...new Set([process.env.ENGINEER_EMAIL, ...(data || []).map((r) => r.value)].filter(Boolean).map((e) => String(e).toLowerCase()))];
}
async function clientEmails(db, project) {
  const to = new Set();
  if (project?.client_email) to.add(project.client_email.toLowerCase());
  if (project?.artist) { const { data } = await db.from('artist_members').select('email').ilike('artist', project.artist); (data || []).forEach((m) => m.email && to.add(m.email.toLowerCase())); }
  return [...to];
}

// Push notifications.
// { action: 'key' } | { action: 'subscribe', sub, device } | { action: 'unsubscribe', endpoint? } | { action: 'status' } | { action: 'test' }
// { action: 'event', kind: 'note' | 'approve', songId, body? }  — sent by the app right after someone leaves a note or approves
export async function POST(req) {
  const slow = limit(req, 'push', 120, 600_000); if (slow) return slow;
  const user = await userFrom(req);
  if (!user) return fail('Sign in first.', 401);
  const b = await req.json().catch(() => ({}));
  const me = user.email.toLowerCase();
  if (b.action === 'key') return json({ key: (await vapidKeys()).pub });
  if (b.action === 'subscribe') {
    if (!b.sub?.endpoint || !b.sub?.keys?.p256dh || !b.sub?.keys?.auth || !/^https:\/\//.test(b.sub.endpoint)) return fail('That device didn’t give a push address.');
    await saveSub(me, b.sub, String(b.device || '').slice(0, 60));
    return json({ ok: true, devices: (await subsFor(me)).map((s) => ({ device: s.device, at: s.at, endpoint: s.endpoint })) });
  }
  if (b.action === 'unsubscribe') { await removeSub(me, b.endpoint || null); return json({ ok: true }); }
  if (b.action === 'status') return json({ devices: (await subsFor(me)).map((s) => ({ device: s.device, at: s.at, endpoint: s.endpoint })) });
  if (b.action === 'test') return json(await pushTo([me], { title: 'CTRL ROOM', body: 'Notifications are on. You’ll get one when something happens.', url: '/settings?tab=notifications' }));

  if (b.action === 'event') {
    const db = admin();
    const { data: song } = await db.from('songs').select('id, title, project_id, projects(id, title, artist, client_email)').eq('id', b.songId).maybeSingle();
    if (!song || !(await canSee(user, song.project_id))) return fail('Not found.', 404);
    const eng = await isEngineer(user);
    const who = user.user_metadata?.display_name || user.user_metadata?.name || (eng ? 'Your engineer' : user.email);
    const text = String(b.body || '').slice(0, 140);
    const to = (eng ? await clientEmails(db, song.projects) : await engineerEmails(db)).filter((e) => e !== me);
    const kind = b.kind === 'approve' ? 'approvals' : 'notes';
    const msg = b.kind === 'approve'
      ? { title: `${song.title} approved ✓`, body: `${who} approved ${song.title}${song.projects?.title ? ` (${song.projects.title})` : ''}.`, url: `/s/${song.id}`, tag: `approve-${song.id}` }
      : { title: `${who} · ${song.title}`, body: text || 'Left a note.', url: `/s/${song.id}#notes` };
    return json(await pushTo(to, msg, { kind }));
  }
  return fail('Unknown action.');
}

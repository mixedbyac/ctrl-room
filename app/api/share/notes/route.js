import { limit } from '@/lib/ratelimit';
import { admin, json, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Comments on share links, only when the engineer allows it for that project.
async function resolveLink(db, t, songId) {
  if (!t || !songId) return null;
  const { data: s } = await db.from('songs').select('id, project_id, share_token, sharing').eq('id', songId).maybeSingle();
  if (!s || s.sharing === false) return null;
  const { data: p } = await db.from('projects').select('id, share_token, sharing, settings, archived').eq('id', s.project_id).maybeSingle();
  if (!p || p.sharing === false || p.archived) return null;
  if (s.share_token !== t && p.share_token !== t) return null;
  if (!p.settings?.share_comments) return null;
  return { song: s, project: p };
}

export async function GET(req) {
  const slow = limit(req, 'share-notes-get', 240, 600_000); if (slow) return slow;
  const u = new URL(req.url);
  const db = admin();
  const ok = await resolveLink(db, u.searchParams.get('t'), u.searchParams.get('songId'));
  if (!ok) return json({ enabled: false, notes: [], reactions: [] });
  const versionId = u.searchParams.get('versionId');
  const { data: notes } = await db.from('notes').select('id, version_id, t, t_end, body, author_name, from_client, guest, parent_id, resolved, created_at, author_email')
    .eq('song_id', ok.song.id).eq('version_id', versionId).order('created_at');
  const ids = (notes || []).map((n) => n.id);
  const { data: reactions } = ids.length ? await db.from('note_reactions').select('note_id, emoji, who').in('note_id', ids) : { data: [] };
  // never hand out emails on a public link
  const clean = (notes || []).map(({ author_email, ...n }) => ({ ...n, author_name: n.author_name || (n.from_client ? (author_email || '').split('@')[0] || 'Client' : 'Engineer') }));
  return json({ enabled: true, notes: clean, reactions: (reactions || []).map((r) => ({ note_id: r.note_id, emoji: r.emoji, who: r.who.startsWith('guest:') ? r.who : 'member' })) });
}

// { t, songId, versionId, action: 'post' | 'react' | 'unreact', body?, at?, atEnd?, parentId?, name?, guestId, noteId?, emoji? }
export async function POST(req) {
  const slow = limit(req, 'share-notes-post', 40, 600_000); if (slow) return slow;
  const b = await req.json().catch(() => null);
  const db = admin();
  const ok = await resolveLink(db, b?.t, b?.songId);
  if (!ok) return fail('Comments aren’t open on this link.', 403);
  const guest = String(b.guestId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  if (!guest) return fail('Missing guest id.');
  if (b.action === 'react' || b.action === 'unreact') {
    const emoji = String(b.emoji || '').slice(0, 16);
    const { data: n } = await db.from('notes').select('id, song_id').eq('id', b.noteId).maybeSingle();
    if (!n || n.song_id !== ok.song.id || !emoji) return fail('Unknown comment.', 404);
    if (b.action === 'react') await db.from('note_reactions').upsert({ note_id: n.id, emoji, who: `guest:${guest}` }, { onConflict: 'note_id,emoji,who', ignoreDuplicates: true });
    else await db.from('note_reactions').delete().eq('note_id', n.id).eq('emoji', emoji).eq('who', `guest:${guest}`);
    return json({ ok: true });
  }
  const body = String(b.body || '').trim().slice(0, 2000);
  const name = String(b.name || '').trim().slice(0, 40) || 'Guest';
  if (!body) return fail('Write something first.');
  let parent = null;
  if (b.parentId) {
    const { data: pn } = await db.from('notes').select('id, song_id').eq('id', b.parentId).maybeSingle();
    if (!pn || pn.song_id !== ok.song.id) return fail('Unknown comment.', 404);
    parent = pn.id;
  }
  const at = Number.isFinite(+b.at) && b.at !== null ? Math.max(0, Math.round(+b.at * 10) / 10) : null;
  const atEnd = Number.isFinite(+b.atEnd) && b.atEnd !== null && at != null && +b.atEnd > at ? Math.round(+b.atEnd * 10) / 10 : null;
  const { data, error } = await db.from('notes').insert({ song_id: ok.song.id, version_id: b.versionId || null, t: parent ? null : at, t_end: parent ? null : atEnd, body, author_name: `${name} (link)`, author_email: null, from_client: true, guest: true, parent_id: parent }).select('id').single();
  if (error) return fail(/column/.test(error.message) ? 'Comments need a database update (010_comments.sql).' : error.message, 500);
  return json({ id: data.id });
}

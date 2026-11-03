import { alertEngineers } from '@/lib/invite';

/**
 * Someone (not an engineer) downloaded mixes: a line on each song's timeline (which also shows in your bell)
 * and one email / phone alert. items: [{ song: { id, title }, label }]. who: a name, or null for a share link.
 */
export async function recordDownload(db, { items, who, project, via }) {
  if (!items?.length) return;
  const name = who || 'Someone on a share link';
  for (const it of items) {
    await db.from('updates').insert({ song_id: it.song.id, from_client: true, body: `${name} downloaded ${it.label}${via === 'link' ? ' from a share link' : ''}.` }).then(() => {}, () => {});
  }
  const what = items.length === 1 ? `${items[0].song.title} ${items[0].label}` : `${items.length} songs${project?.title ? ` from ${project.title}` : ''}`;
  await alertEngineers(db, {
    kind: 'downloads', subject: `${name} downloaded ${what}`,
    text: `${name} downloaded ${what}${project?.artist ? ` (${project.artist})` : ''}${via === 'link' ? ' from a share link' : ''}.`,
    link: items.length === 1 ? `/s/${items[0].song.id}` : project?.id ? `/p/${project.id}` : '/', linkLabel: 'Open in CTRL ROOM',
  }).catch(() => {});
}

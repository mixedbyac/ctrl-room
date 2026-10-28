// Spots signs that a share link has leaked: a sudden run of plays, a place nobody on the project has
// listened from before, or one link spreading across lots of devices. Used by the server (to text you
// right away) and by the Insights page.

export const isShareSource = (src) => /share link/i.test(String(src || ''));
export const placeOf = (device) => (String(device || '').split(' — ')[1] || '').trim();
export const deviceOf = (device) => String(device || '').split(' — ')[0].trim();
export const linkKind = (src) => (/project share link/i.test(String(src || '')) ? 'project' : 'song');

const MIN = 60 * 1000;
const at = (p) => new Date(p.started_at || p.updated_at).getTime();

/**
 * plays: [{ id, song_id, started_at, device, source, listener_email, songs: { title, project_id, projects: { title, artist } } }]
 * returns newest-first alerts: { key, kind, songId, projectId, title, project, linkKind, at, text, place }
 */
export function findLeaks(plays, { now = Date.now(), days = 14 } = {}) {
  const recent = plays.filter((p) => now - at(p) < days * 24 * 60 * MIN).sort((a, b) => at(a) - at(b));
  const alerts = new Map();
  const add = (a) => { if (!alerts.has(a.key)) alerts.set(a.key, a); };
  const seenPlaces = new Map(); // project -> Set of places heard from so far
  const bySong = new Map();
  for (const p of recent) {
    const proj = p.songs?.project_id || p.song_id;
    const place = placeOf(p.device);
    const share = isShareSource(p.source);
    const meta = { songId: p.song_id, projectId: p.songs?.project_id, title: p.songs?.title || 'a song', project: p.songs?.projects?.title || '', linkKind: linkKind(p.source) };
    const day = new Date(at(p)).toISOString().slice(0, 10);
    if (share && place) {
      const seen = seenPlaces.get(proj);
      if (seen && seen.size && !seen.has(place)) {
        add({ ...meta, key: `place:${p.song_id}:${place}`, kind: 'place', at: at(p), place,
          text: `Played from ${place} on a share link. Nobody on this project has listened from there before.` });
      }
    }
    if (place) { if (!seenPlaces.has(proj)) seenPlaces.set(proj, new Set()); seenPlaces.get(proj).add(place); }
    if (share) {
      if (!bySong.has(p.song_id)) bySong.set(p.song_id, []);
      const list = bySong.get(p.song_id);
      list.push(p);
      const burst = list.filter((x) => at(p) - at(x) <= 10 * MIN);
      if (burst.length >= 4) {
        const places = [...new Set(burst.map((x) => placeOf(x.device)).filter(Boolean))];
        add({ ...meta, key: `burst:${p.song_id}:${day}`, kind: 'burst', at: at(p), place: places[0] || '',
          text: `${burst.length} plays in 10 minutes on a share link${places.length ? ` from ${places.join(', ')}` : ''}.` });
      }
      const dayList = list.filter((x) => at(p) - at(x) <= 24 * 60 * MIN);
      const spots = new Set(dayList.map((x) => `${deviceOf(x.device)}|${placeOf(x.device)}`));
      if (spots.size >= 5) {
        add({ ...meta, key: `spread:${p.song_id}:${day}`, kind: 'spread', at: at(p), place: '',
          text: `One share link was opened on ${spots.size} different devices or places in a day. It may be in too many hands.` });
      }
    }
  }
  return [...alerts.values()].sort((a, b) => b.at - a.at);
}

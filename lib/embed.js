// Songs and versions are linked two ways (a version belongs to a song; a song can point at its active version).
// When loading a song's versions we must say which link we mean, or the database refuses the request.
export const V = 'versions:versions!versions_song_id_fkey';

/** Runs a select with the explicit link, and falls back to the plain form on older databases. */
export async function selectWithVersions(build) {
  let r = await build(V);
  if (r.error && /relationship|versions_song_id_fkey|hint/i.test(r.error.message)) r = await build('versions');
  return r;
}

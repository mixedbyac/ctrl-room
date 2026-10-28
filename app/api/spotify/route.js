import { limit } from '@/lib/ratelimit';
import { fetchSpotifyArtist, spotifyArtistId } from '@/lib/spotify';

export const runtime = 'nodejs';
export const maxDuration = 20;

// Public: preview an artist from a Spotify link so forms can fill in the artist's name, photo and bio.
export async function GET(req) {
  const slow = limit(req, 'spotify', 60, 600000); if (slow) return slow;
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!spotifyArtistId(url)) return Response.json({ error: 'Paste a Spotify artist link (open.spotify.com/artist/…).' }, { status: 400 });
  try {
    const a = await fetchSpotifyArtist(url);
    return Response.json({ name: a.display_name, image: a.image_url, listeners: a.listeners, genres: a.genres, bio: a.bio, url: a.spotify_url },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

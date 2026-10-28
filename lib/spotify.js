// Pull an artist's public profile from Spotify: name, photo, header, bio, listeners, genres.
// Works without keys (public page + oEmbed). With SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET it also gets genres and followers.

export function spotifyArtistId(url) {
  const s = String(url || '').trim();
  const m = s.match(/spotify:artist:([A-Za-z0-9]{22})/) || s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

const decode = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i')) || html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'));
  return m ? decode(m[1]) : null;
};
const stripTags = (t) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const unjson = (t) => { try { return JSON.parse(`"${t}"`); } catch { return t; } };

async function apiToken() {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: 'grant_type=client_credentials',
  }).catch(() => null);
  if (!r?.ok) return null;
  return (await r.json()).access_token || null;
}

export async function fetchSpotifyArtist(url) {
  const id = spotifyArtistId(url);
  if (!id) throw new Error('That doesn’t look like a Spotify artist link. Open the artist on Spotify › ••• › Share › Copy link to artist.');
  const page = `https://open.spotify.com/artist/${id}`;
  const out = { spotify_id: id, spotify_url: page, display_name: null, image_url: null, header_url: null, bio: null, listeners: null, genres: null, followers: null };

  const [oe, html, tok] = await Promise.all([
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(page)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(page, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en' } })
      .then((r) => (r.ok ? r.text() : '')).catch(() => ''),
    apiToken(),
  ]);

  if (oe) { out.display_name = oe.title || null; out.image_url = oe.thumbnail_url || null; }
  if (html) {
    const title = meta(html, 'og:title'), img = meta(html, 'og:image'), desc = meta(html, 'og:description') || meta(html, 'description') || '';
    if (title) out.display_name = title.replace(/\s*\|\s*Spotify.*$/i, '');
    if (img) out.image_url = img;
    const ml = desc.match(/([\d.,]+\s?[KMB]?)\s+monthly listeners/i);
    if (ml) out.listeners = ml[1].replace(/\s/g, '');
    // the page's embedded data sometimes carries the header image and bio
    let blob = html;
    const st = html.match(/<script[^>]+id="initialState"[^>]*>([^<]+)<\/script>/);
    if (st) { try { blob += Buffer.from(st[1].trim(), 'base64').toString('utf8'); } catch {} }
    const hdr = blob.match(/"headerImage"\s*:\s*\{\s*"data"\s*:\s*\{\s*"sources"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"(https:[^"]+)"/);
    if (hdr) out.header_url = unjson(hdr[1]);
    const bio = blob.match(/"biography"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (bio) { const b = stripTags(decode(unjson(bio[1]))); if (b) out.bio = b.slice(0, 1200); }
    if (!out.listeners) { const m2 = blob.match(/"monthlyListeners"\s*:\s*(\d+)/); if (m2) out.listeners = Number(m2[1]).toLocaleString('en-US'); }
  }
  if (tok) {
    const a = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (a) {
      out.display_name = a.name || out.display_name;
      if (a.images?.[0]?.url) out.image_url = a.images[0].url;
      if (a.genres?.length) out.genres = a.genres.slice(0, 4).join(', ');
      if (a.followers?.total != null) out.followers = a.followers.total;
    }
  }
  if (!out.display_name && !out.image_url) throw new Error('Couldn’t reach that artist on Spotify. Check the link and try again.');
  return out;
}

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

  if (oe) { out.display_name = (oe.title || '').trim() || null; out.image_url = oe.thumbnail_url || null; }
  if (html) {
    const title = meta(html, 'og:title'), img = meta(html, 'og:image'), desc = meta(html, 'og:description') || meta(html, 'description') || '';
    if (title) out.display_name = title.replace(/\s*[|·–-]\s*Spotify.*$/i, '').replace(/\s*[|–-]\s*(Songs|Albums|Listen).*$/i, '').trim();
    if (img) out.image_url = img;
    const ml = desc.match(/([\d.,]+\s?[KMB]?)\s+monthly listeners/i);
    if (ml) out.listeners = ml[1].replace(/\s/g, '');
    // the page's embedded data sometimes carries the header image and bio
    let blob = html;
    const st = html.match(/<script[^>]+id="initialState"[^>]*>([^<]+)<\/script>/);
    if (st) { try { blob += Buffer.from(st[1].trim(), 'base64').toString('utf8'); } catch {} }
    const hdr = blob.match(/"headerImage"\s*:\s*\{\s*"data"\s*:\s*\{\s*"sources"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"(https:[^"]+)"/);
    if (hdr) out.header_url = unjson(hdr[1]);
    const bio = blob.match(/"biography"\s*:\s*\{[^{}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/) || blob.match(/"biography"\s*:\s*"((?:[^"\\]|\\.)+)"/);
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
  // no bio from Spotify? Fall back to the artist's Wikipedia summary (only if it's clearly about a music act)
  if (!out.bio && out.display_name) out.bio = await wikiBio(out.display_name, out.genres).catch(() => null);
  if (out.display_name) out.display_name = out.display_name.replace(/\s+/g, ' ').trim();
  if (!out.display_name && !out.image_url) throw new Error('Couldn’t reach that artist on Spotify. Check the link and try again.');
  return out;
}

const MUSIC = /\b(rapper|singer|songwriter|musician|band|producer|DJ|duo|group|record producer|hip hop|R&B|recording artist|vocalist|composer)\b/i;
async function wikiBio(name) {
  const q = encodeURIComponent(name.replace(/\s+/g, '_'));
  for (const title of [`${q}_(musician)`, `${q}_(rapper)`, `${q}_(singer)`, `${q}_(band)`, q]) {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'CTRL ROOM (art-house.us)' } });
    if (!r.ok) continue;
    const j = await r.json();
    if (j.type === 'disambiguation' || !j.extract) continue;
    if (MUSIC.test(`${j.description || ''} ${j.extract.slice(0, 300)}`)) return j.extract.slice(0, 1200);
  }
  return null;
}

// Genius (free API) — lyric line + community annotation lookup for diss
// posts, and (used here) artist photos: virtually anyone with a song on
// Genius has a profile photo, which covers underground/regional hip-hop
// far better than mainstream-skewed alternatives.
import { config } from "../config.js";

const API = "https://api.genius.com";

function authHeaders() {
  if (!config.genius.accessToken) throw new Error("GENIUS_ACCESS_TOKEN missing");
  return { Authorization: `Bearer ${config.genius.accessToken}` };
}

export async function searchGenius(query) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`genius search ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json?.response?.hits || [];
}

export async function getGeniusSong(id) {
  const res = await fetch(`${API}/songs/${id}?text_format=plain`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`genius song ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json?.response?.song || null;
}

// Genius shows a generic placeholder for artists with no uploaded photo —
// treat that as "no real photo" rather than a usable one.
function isPlaceholderAvatar(url) {
  return !url || url.includes("default_avatar");
}

export async function getArtistPhoto(artist) {
  const hits = await searchGenius(artist);
  for (const hit of hits) {
    const primaryArtist = hit?.result?.primary_artist;
    if (!primaryArtist) continue;
    if (primaryArtist.name?.toLowerCase() !== artist.toLowerCase()) continue;
    if (!isPlaceholderAvatar(primaryArtist.image_url)) return primaryArtist.image_url;
  }
  return null;
}

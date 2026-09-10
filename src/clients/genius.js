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

// Genius's API never exposes full lyrics text (licensing) — referents are
// the API-native way to get an exact, verbatim lyric excerpt: each is a
// community-annotated fragment plus the annotation body explaining it.
export async function getReferents(songId, perPage = 20) {
  const res = await fetch(`${API}/referents?song_id=${songId}&text_format=plain&per_page=${perPage}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`genius referents ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json?.response?.referents || [];
}

// Genius shows a generic placeholder for artists with no uploaded photo —
// treat that as "no real photo" rather than a usable one.
function isPlaceholderAvatar(url) {
  return !url || url.includes("default_avatar");
}

// Finds the hit whose primary_artist name matches (case-insensitive) —
// shared by getArtistPhoto and getArtistInstagramHandle so both key off the
// same confident-match rule instead of just taking the top search hit
// (which can be a different artist's collab track).
function findConfidentArtistMatch(hits, artist) {
  for (const hit of hits) {
    const primaryArtist = hit?.result?.primary_artist;
    if (primaryArtist?.name?.toLowerCase() === artist.toLowerCase()) return primaryArtist;
  }
  return null;
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

// Genius artist profiles carry a self-reported Instagram handle
// (instagram_name) for most working artists — this is the caption's only
// source for @-mentioning the artist's IG, so a miss just means no mention,
// never a guess.
export async function getArtistInstagramHandle(artist) {
  const hits = await searchGenius(artist);
  const match = findConfidentArtistMatch(hits, artist);
  if (!match) return null;

  const res = await fetch(`${API}/artists/${match.id}`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(`genius artist ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json?.response?.artist?.instagram_name || null;
}

// Spotify Web API (Client Credentials flow — no user login) — authoritative
// tracklist source for album_drop posts, instead of relying on Gemini to
// infer track names from a two-sentence Discord blurb.
import { config } from "../config.js";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET missing");
  }
  const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`spotify token ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  cachedToken = json.access_token;
  cachedTokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

async function spotifyGet(path) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`spotify ${path} ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function searchAlbum(artist, title) {
  const q = `album:"${title}" artist:"${artist}"`;
  const json = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=album&limit=10`);
  return json.albums?.items?.[0] || null;
}

async function getAlbumTracks(albumId) {
  const json = await spotifyGet(`/albums/${albumId}/tracks?limit=50`);
  return (json.items || []).map((t) => t.name);
}

// Returns { tracklist, albumArtUrl }, either of which may be null if
// there's no confident match or the album has no art on Spotify.
export async function getAlbumInfo(artist, title) {
  const album = await searchAlbum(artist, title);
  if (!album) return { tracklist: null, albumArtUrl: null };

  const tracks = await getAlbumTracks(album.id);
  return {
    tracklist: tracks.length ? tracks : null,
    albumArtUrl: album.images?.[0]?.url || null,
  };
}

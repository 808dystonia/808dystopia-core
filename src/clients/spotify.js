// Spotify Web API (Client Credentials flow — no user login) — authoritative
// tracklist source for album_drop posts, instead of relying on the step 2
// classifier to infer track names from a two-sentence Discord blurb.
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

async function spotifyGetUrl(url) {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`spotify ${url} ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function spotifyGet(path) {
  return spotifyGetUrl(`https://api.spotify.com/v1${path}`);
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

// Spotify's artist search returns several same-named results for lesser-
// known artists (confirmed live against real underground names) -- an
// exact case-insensitive name match is the only confident signal
// available without another identifier to disambiguate with, so a miss
// here just means "skip this artist this cycle," never a guess at the
// wrong same-named artist.
async function searchArtist(name) {
  const json = await spotifyGet(`/search?q=${encodeURIComponent(name)}&type=artist&limit=10`);
  const items = json.artists?.items || [];
  return items.find((a) => a.name.toLowerCase() === name.toLowerCase()) || null;
}

// Every album/single release for an artist, newest first, each with its
// cover art URL -- the Pin pipeline's source of candidate cover art.
// Releases with no art at all (rare, but real) are dropped rather than
// pinning a blank/placeholder image.
//
// This endpoint's max `limit` is 10, not the 50 its own docs describe --
// confirmed live (values above 10 return a 400 "Invalid limit"), so
// anything beyond one page needs its `next` cursor followed. Capped at 5
// pages (50 releases) -- plenty for the "lesser known artists" this
// pipeline is actually about, and most watchlist artists won't have
// anywhere near that many releases to begin with.
export async function getArtistReleases(name) {
  const artist = await searchArtist(name);
  if (!artist) return [];

  const items = [];
  let url = `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=US`;
  for (let page = 0; page < 5 && url; page++) {
    const json = await spotifyGetUrl(url);
    items.push(...(json.items || []));
    url = json.next || null;
  }

  return items
    .map((a) => ({
      name: a.name,
      releaseDate: a.release_date || "",
      imageUrl: a.images?.[0]?.url || null,
      spotifyUrl: a.external_urls?.spotify || null,
    }))
    .filter((a) => a.imageUrl)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

// Release data with a backup: Spotify first, Apple's iTunes Search API
// when Spotify fails (10/04 it refused every call pending Premium on the
// app owner) or simply has no match.
import { getAlbumInfo as spotifyAlbumInfo, getArtistReleases as spotifyReleases } from "./spotify.js";
import { getItunesAlbumInfo, getItunesArtistReleases } from "./itunes.js";

export async function getAlbumInfo(artist, title, deps = {}) {
  const { spotify = spotifyAlbumInfo, itunes = getItunesAlbumInfo } = deps;
  let fromSpotify = { tracklist: null, albumArtUrl: null };
  try {
    fromSpotify = await spotify(artist, title);
    if (fromSpotify.tracklist) return fromSpotify;
  } catch (err) {
    console.log("spotify album info, trying iTunes:", err.message);
  }
  const fromItunes = await itunes(artist, title);
  return {
    tracklist: fromItunes.tracklist,
    albumArtUrl: fromItunes.albumArtUrl || fromSpotify.albumArtUrl,
  };
}

export async function getArtistReleases(name, deps = {}) {
  const { spotify = spotifyReleases, itunes = getItunesArtistReleases } = deps;
  try {
    const releases = await spotify(name);
    if (releases.length) return releases;
  } catch (err) {
    console.log(`spotify releases for ${name}, trying iTunes:`, err.message);
  }
  return itunes(name);
}

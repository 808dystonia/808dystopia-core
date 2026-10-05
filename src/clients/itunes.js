// Apple's iTunes Search API: free, no key or account. The backup for
// Spotify's release data (tracklists, cover art, artist catalogs) since
// Spotify started refusing our dev-mode app on 10/04 ("Active premium
// subscription required for the owner of the app"). It has no artist
// photos or follower counts, so those still need Spotify.
//
// Matching mirrors the Spotify client: exact (case-insensitive) artist
// name only. When several artists share a name, album lookups use the
// one whose catalog actually has the release; catalogs use the biggest.
const API = "https://itunes.apple.com";

async function get(path, fetchImpl) {
  const res = await fetchImpl(`${API}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  return res.json();
}

const compact = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
// "Never Leave - Single" -> "Never Leave"
export const cleanReleaseName = (name) => String(name || "").replace(/\s*-\s*(single|ep)\s*$/i, "").trim();
// 100x100 is the URL's default; Apple serves the same art up to 3000px.
export const bigArtwork = (url) => (url ? url.replace(/\/\d+x\d+bb\./, "/1000x1000bb.") : null);
const isFeature = (album) => /\((feat|with)\.?\s/i.test(album.collectionName || "");

async function exactArtists(name, fetchImpl) {
  const json = await get(`/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=10`, fetchImpl);
  return (json.results || []).filter((a) => compact(a.artistName) === compact(name) && compact(name));
}

async function albumsOf(artistId, fetchImpl) {
  const json = await get(`/lookup?id=${artistId}&entity=album&limit=200`, fetchImpl);
  return (json.results || [])
    .filter((r) => r.wrapperType === "collection" && !isFeature(r))
    .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)));
}

// Same shape as spotify.getAlbumInfo: { tracklist, albumArtUrl }.
export async function getItunesAlbumInfo(artist, title, fetchImpl = fetch) {
  const target = compact(cleanReleaseName(title));
  if (!target) return { tracklist: null, albumArtUrl: null };
  for (const a of await exactArtists(artist, fetchImpl)) {
    const album = (await albumsOf(a.artistId, fetchImpl)).find((al) => compact(cleanReleaseName(al.collectionName)) === target);
    if (!album) continue;
    const json = await get(`/lookup?id=${album.collectionId}&entity=song&limit=200`, fetchImpl);
    const tracks = (json.results || [])
      .filter((r) => r.wrapperType === "track")
      .sort((x, y) => (x.discNumber - y.discNumber) || (x.trackNumber - y.trackNumber))
      .map((t) => t.trackName);
    return { tracklist: tracks.length ? tracks : null, albumArtUrl: bigArtwork(album.artworkUrl100) };
  }
  return { tracklist: null, albumArtUrl: null };
}

// Same shape as spotify.getArtistReleases, newest first. spotifyUrl holds
// the Apple Music link (used as the pin's link).
export async function getItunesArtistReleases(name, fetchImpl = fetch) {
  let best = [];
  for (const a of await exactArtists(name, fetchImpl)) {
    const albums = await albumsOf(a.artistId, fetchImpl);
    if (albums.length > best.length) best = albums;
  }
  return best
    .map((al) => ({
      name: cleanReleaseName(al.collectionName),
      releaseDate: String(al.releaseDate || "").slice(0, 10),
      imageUrl: bigArtwork(al.artworkUrl100),
      spotifyUrl: al.collectionViewUrl || null,
    }))
    .filter((r) => r.imageUrl);
}

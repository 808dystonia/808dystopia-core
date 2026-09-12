// Step 1: pick one artist+album combo to pin. Artists come from the same
// #reels watchlist the Reel pipeline already reads (src/clients/discord.js's
// parseWatchlist()) -- reusing it rather than maintaining a second list,
// since it's already the team's curated "who we cover" roster.
import { listReelsChannelMessages, parseWatchlist } from "../clients/discord.js";
import { getArtistReleases } from "../clients/spotify.js";
import { readPinLogRows, isAlbumAlreadyPinned } from "../clients/googleSheets.js";

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Tries artists in random order (so it's not always the same handful at
// the top of the watchlist getting pinned) until one has a release not
// already logged as posted. Returns null -- never a fabricated pick --
// if every artist's entire catalog is already covered, or the watchlist
// itself is empty.
export async function getCandidate() {
  const messages = await listReelsChannelMessages();
  const artists = parseWatchlist(messages);
  if (artists.length === 0) return null;

  const logRows = await readPinLogRows();

  for (const artist of shuffle(artists)) {
    let releases;
    try {
      releases = await getArtistReleases(artist);
    } catch (err) {
      console.log(`spotify lookup failed for ${artist}:`, err.message);
      continue;
    }
    const unclaimed = releases.filter((r) => !isAlbumAlreadyPinned(logRows, { artist, album: r.name }));
    if (unclaimed.length > 0) {
      return { artist, album: unclaimed[0] };
    }
  }
  return null;
}

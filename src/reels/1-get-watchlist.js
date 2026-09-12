// Step 1: get the pool of artists/producers the Reel pipeline can
// feature. This channel (still named #reels in config -- FRZA's own
// Discord UI now labels it #tv, same channel id, confirmed live) carries
// two different message formats from two different bots:
//   - a running watchlist (who's currently followed on the 808dystopia
//     IG account), backtick-quoted handles under category headers
//   - Grok's own "808 TV // UNDERGROUND HEAT" board, numbered
//     RAPPERS/PRODUCERS lists refreshed daily
// parseWatchlist and parseTvBoard each pull their own shape out of the
// same fetched messages -- not two separate channels/fetches, just two
// parsers over one message list. Merged case-insensitively: more
// current-name coverage for findVideo (step 2) to search against, not a
// replacement for the curated IG-following list.
import { listReelsChannelMessages, parseWatchlist, parseTvBoard } from "../clients/discord.js";

export async function getArtistWatchlist() {
  const messages = await listReelsChannelMessages();
  const watchlist = parseWatchlist(messages);
  const tvNames = parseTvBoard(messages);

  const merged = new Map(); // lowercase -> as-written casing
  for (const name of watchlist) merged.set(name.toLowerCase(), name);
  for (const name of tvNames) {
    if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), name);
  }
  return [...merged.values()];
}

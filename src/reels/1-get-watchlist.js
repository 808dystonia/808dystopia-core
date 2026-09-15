// Step 1: get the pool of artists/producers the Reel pipeline can
// feature, plus any curated TikTok links posted in the same channel.
// This channel (still named #reels in config -- FRZA's own Discord UI
// now labels it #tv, same channel id, confirmed live) carries several
// different message formats from different bots:
//   - a running watchlist (who's currently followed on the 808dystopia
//     IG account), backtick-quoted handles under category headers
//   - Grok's own "808 TV // UNDERGROUND HEAT" board, numbered
//     RAPPERS/PRODUCERS lists refreshed daily
//   - occasional TikTok video links (no fixed format -- see
//     parseTikTokUrls), a curated source for step 2's TikTok fallback
//     (clients/tiktok.js) since TikTok has no search API to fall back to
// All parsed out of the same fetched messages -- one fetch, not one per
// format. Artist names are merged case-insensitively: more current-name
// coverage for findVideo (step 2) to search against, not a replacement
// for the curated IG-following list.
import { listReelsChannelMessages, parseWatchlist, parseTvBoard, parseTikTokUrls } from "../clients/discord.js";

export async function getWatchlistAndTikTokUrls() {
  const messages = await listReelsChannelMessages();
  const watchlist = parseWatchlist(messages);
  const tvNames = parseTvBoard(messages);
  const tiktokUrls = parseTikTokUrls(messages);

  const merged = new Map(); // lowercase -> as-written casing
  for (const name of watchlist) merged.set(name.toLowerCase(), name);
  for (const name of tvNames) {
    if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), name);
  }
  return { artists: [...merged.values()], tiktokUrls };
}

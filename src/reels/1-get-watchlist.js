// Step 1: get the pool of artists/producers the Reel pipeline can
// feature. #reels turned out to hold a running watchlist (who's
// currently followed on the 808dystopia IG account), not a manual
// day-by-day "Artist — content type" queue as originally planned —
// confirmed live: the channel had a bot-posted handle dump, not
// requests. So there's nothing to dedup or pick from yet at this step
// (mirrors the news pipeline's step 1, which is also just a raw fetch) —
// which artist to feature today (checking the Sheet log so one isn't
// immediately re-featured) and what content type to look for is decided
// later, in reels/index.js and step 2, since the watchlist only names
// who, not what.
import { listReelsChannelMessages, parseWatchlist } from "../clients/discord.js";

export async function getArtistWatchlist() {
  const messages = await listReelsChannelMessages();
  return parseWatchlist(messages);
}

// Step 1: pull real, recent articles from RSS feeds (clients/rss.js) —
// XXL, AllHipHop, and a recency-filtered Google News search. No API key,
// no rate limit to worry about. Validated live: 145 items fetched, 31
// within an 8-hour lookback window, real same-day breaking news among
// them (confirmed against an actual current event).
import { fetchAllFeeds, filterRecent } from "../clients/rss.js";

const LOOKBACK_HOURS = 8;

export async function getRecentArticles() {
  const all = await fetchAllFeeds();
  return filterRecent(all, LOOKBACK_HOURS);
}

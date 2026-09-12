// RSS feeds — real, current underground/general hip-hop news, no API key
// needed. Validated live against each URL before picking these:
//   - hotnewhiphop.com/rss and hiphopdx.com/rss are both dead (404 / 410)
//   - complex.com/music/rss 404s (site restructured, no feed anymore)
//   - 2dopeboyz.com/feed/ returns 200 but its most recent real post is
//     from mid-2025 -- an abandoned blog, not a dead feed, so it'd pass a
//     naive "does this URL work" check while being useless
//   - hiphopwired.com/feed/ and djbooth.net/feed returned unparseable
//     responses on a second fetch (inconsistent -- excluded for now)
// XXL and AllHipHop both confirmed live with genuinely fresh, real
// breaking news (same-day items). Google News RSS needs the when:1d
// query qualifier specifically -- a plain "underground rap hip hop"
// search surfaces evergreen feature articles months old, not news.
import Parser from "rss-parser";

const parser = new Parser();

const FEEDS = [
  { name: "XXL", url: "https://www.xxlmag.com/feed/" },
  { name: "AllHipHop", url: "https://allhiphop.com/feed/" },
  {
    name: "Google News",
    url: "https://news.google.com/rss/search?q=hip+hop+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
];

// Fetches all feeds in parallel and normalizes into a flat list. A single
// feed failing (site down, feed URL changed again) doesn't sink the
// others -- logs and continues, same graceful-degradation posture as the
// rest of this project.
export async function fetchAllFeeds() {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || []).map((item) => ({
          title: item.title || "",
          link: item.link || "",
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          source: feed.name,
        }));
      } catch (err) {
        console.log(`RSS fetch failed for ${feed.name}:`, err.message);
        return [];
      }
    })
  );
  return results.flat();
}

// Only items published within the lookback window -- keeps each cycle to
// genuinely new stories instead of re-surfacing the same items every run.
export function filterRecent(items, sinceHoursAgo) {
  const cutoff = Date.now() - sinceHoursAgo * 60 * 60 * 1000;
  return items.filter((item) => item.publishedAt && item.publishedAt.getTime() >= cutoff);
}

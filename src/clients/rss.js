// RSS feeds — real, current underground/general hip-hop news, no API key
// needed. Validated live against each URL before picking these:
//   - hotnewhiphop.com/rss and hiphopdx.com/rss are both dead (404 / 410)
//   - complex.com/music/rss 404s (site restructured, no feed anymore)
//   - 2dopeboyz.com/feed/, ambrosiaforheads.com/feed/, and
//     respect-mag.com/feed/ all return 200 but their most recent real
//     posts are months old -- abandoned blogs, not dead feeds, so each
//     would pass a naive "does this URL work" check while being useless
//   - hiphopwired.com/feed/ and djbooth.net/feed returned unparseable
//     responses on a second fetch (inconsistent -- excluded for now)
// XXL and AllHipHop both confirmed live with genuinely fresh, real
// breaking news (same-day items) -- general hip-hop press, skews
// mainstream/chart/celebrity. The plain "hip hop" Google News query skews
// the same way (that's just what's published most), which is why a
// second, underground-targeted query is also included -- confirmed live
// this surfaces a meaningfully different, much more underground-leaning
// pool (indie drops, local-scene features, underground artist news)
// instead of just more of the same mainstream stories. Both still need
// the when:1d qualifier -- a plain keyword search surfaces evergreen
// feature articles months old, not news.
import Parser from "rss-parser";

const parser = new Parser();

const FEEDS = [
  { name: "XXL", url: "https://www.xxlmag.com/feed/" },
  { name: "AllHipHop", url: "https://allhiphop.com/feed/" },
  {
    name: "Google News",
    url: "https://news.google.com/rss/search?q=hip+hop+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News (Underground)",
    url: "https://news.google.com/rss/search?q=underground+rap+OR+underground+hip+hop+when:1d&hl=en-US&gl=US&ceid=US:en",
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

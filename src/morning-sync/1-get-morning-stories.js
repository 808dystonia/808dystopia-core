// Step 1: pull today's Grok "Morning Heat" drop from #underground-news and
// return its stories, if it's landed yet. This never posts anything new —
// Grok's own scheduled task already did that — it only mirrors what's
// already there onto the site, so a miss just means "check again later,"
// never a guess at what the drop would have said.
//
// #underground-news also carries this repo's own News Brief posts (same
// digest embed shape, on purpose — see news-brief/3-post-digest.js), so
// "today's oldest message" alone isn't a safe way to find Grok's post: a
// manual/test News Brief run earlier in the day would be mistaken for it.
// Filtering to config.discord.grokAuthorId (confirmed live to be Grok's
// stable webhook identity, distinct from this repo's shared Composio bot
// account) is what actually makes this reliable.
import { listHeatChannelMessages, splitIntoStories } from "../clients/discord.js";
import { chicagoDateString } from "../util/chicagoHour.js";
import { config } from "../config.js";

export async function getMorningStories() {
  const messages = await listHeatChannelMessages();
  const today = chicagoDateString(new Date());
  const todaysGrokMessages = messages.filter(
    (m) => chicagoDateString(new Date(m.timestamp)) === today && m.author?.id === config.discord.grokAuthorId
  );
  if (todaysGrokMessages.length === 0) return [];

  // Newest-first list — take the oldest of today's Grok messages, in case
  // more than one landed today.
  const morningMessage = todaysGrokMessages[todaysGrokMessages.length - 1];
  return splitIntoStories([morningMessage]).map((s) => s.text);
}

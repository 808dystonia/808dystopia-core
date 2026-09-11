// Discord read, via Composio's Discordbot toolkit. Two channels feed two
// separate pipelines: #underground-news (the Grok scraper's story digest,
// news carousel) and #reels (the Reel pipeline's artist watchlist).
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function listChannelMessages(channelId, limit = 25) {
  const res = await runTool(
    "DISCORDBOT_LIST_MESSAGES",
    { channel_id: channelId, limit },
    config.discord.connectedAccountId || undefined
  );
  // The raw REST response wraps messages under `details` (confirmed against
  // a live call) — not `messages`, despite that being what the CLI's SDK
  // layer renames it to internally when it prints results.
  const messages = res?.details || [];
  // DISCORDBOT_LIST_MESSAGES is documented as newest-first; sort defensively
  // in case that's not what actually comes back.
  return [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Confirmed against a live call: each message is a daily "Morning Heat"
// digest embed, not one message per story. The embed description is a list
// of "• " bulleted stories with no source URLs (sources are cited
// parenthetically, e.g. "(HNHH)"). So a "story" is one bullet line, not one
// message — see splitIntoStories().
export async function listHeatChannelMessages(limit = 25) {
  if (!config.discord.heatChannelId) throw new Error("DISCORD_HEAT_CHANNEL_ID missing");
  return listChannelMessages(config.discord.heatChannelId, limit);
}

// Confirmed against a live call: #reels holds a running watchlist (who's
// currently followed on the 808dystopia IG account) posted/reposted by a
// bot as backtick-quoted handles under category headers — not one
// "Artist — content type" request per message, despite that being the
// original plan. See parseWatchlist().
export async function listReelsChannelMessages(limit = 25) {
  if (!config.discord.reelsChannelId) throw new Error("DISCORD_REELS_CHANNEL_ID missing");
  return listChannelMessages(config.discord.reelsChannelId, limit);
}

// #reels' watchlist is posted as backtick-quoted handles under category
// headers (e.g. "**Producers**", "**Artists A-L**") — parsed generically
// (any backtick-quoted token, regardless of header) so a new category
// doesn't need a code change. Handles are deduplicated case-insensitively;
// messages are processed oldest-first so a re-posted/updated dump's
// spelling wins over an earlier one for the same handle.
export function parseWatchlist(messages) {
  const handles = new Map(); // lowercase -> as-written casing
  for (const message of [...messages].reverse()) {
    for (const [, handle] of message.content.matchAll(/`([^`]+)`/g)) {
      const trimmed = handle.trim();
      if (trimmed) handles.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...handles.values()];
}

// Flattens recent digest messages into individual story candidates, ordered
// newest-first (message order), then in the order each bullet appears within
// its digest.
export function splitIntoStories(messages) {
  const stories = [];
  for (const message of messages) {
    const description = message.embeds?.[0]?.description || "";
    const bullets = description
      .split("\n")
      .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
      .filter((line) => line && !line.startsWith("("));
    bullets.forEach((text, index) => {
      stories.push({
        messageId: message.id,
        bulletIndex: index,
        text,
        timestamp: message.timestamp,
      });
    });
  }
  return stories;
}

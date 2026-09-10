// Discord read, via Composio's Discordbot toolkit — pulls recent messages
// from the #underground-news heat channel that the Grok scraper posts into.
//
// Confirmed against a live call: each message is a daily "Morning Heat"
// digest embed, not one message per story. The embed description is a list
// of "• " bulleted stories with no source URLs (sources are cited
// parenthetically, e.g. "(HNHH)"). So a "story" is one bullet line, not one
// message — see splitIntoStories().
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function listHeatChannelMessages(limit = 25) {
  if (!config.discord.heatChannelId) throw new Error("DISCORD_HEAT_CHANNEL_ID missing");

  const res = await runTool(
    "DISCORDBOT_LIST_MESSAGES",
    { channel_id: config.discord.heatChannelId, limit },
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

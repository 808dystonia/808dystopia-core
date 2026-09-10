// Discord read, via Composio's Discordbot toolkit — pulls recent messages
// from the #underground-news heat channel that the Grok scraper posts into.
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function listHeatChannelMessages(limit = 25) {
  if (!config.discord.heatChannelId) throw new Error("DISCORD_HEAT_CHANNEL_ID missing");

  const res = await runTool("DISCORDBOT_LIST_MESSAGES", {
    channel_id: config.discord.heatChannelId,
    limit,
  });
  const messages = normalizeMessages(res);
  // DISCORDBOT_LIST_MESSAGES is documented as newest-first; sort defensively
  // in case that's not what actually comes back.
  return messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// The exact wrapping of Composio's response hasn't been confirmed against a
// live call yet (needs COMPOSIO_API_KEY to test). This tries the shapes
// Composio commonly uses; adjust once we've run this for real.
function normalizeMessages(res) {
  const candidates = [res, res?.messages, res?.items, res?.details];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

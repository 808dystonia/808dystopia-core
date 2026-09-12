// Discord read/write, via Composio's Discordbot toolkit. Three channels
// feed three separate pipelines: #underground-news (the Grok scraper's
// story digest, news carousel), #reels (the Reel pipeline's artist
// watchlist), and #admin-general (the EOD brief posts here — the only
// pipeline that writes to Discord rather than just reading from it).
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

// This same channel (config.discord.reelsChannelId -- FRZA's Discord UI
// labels it #tv, confirmed live it's the identical channel id, not a
// second one) also carries Grok's own "808 TV // UNDERGROUND HEAT" board,
// external to this repo, refreshed daily, in numbered RAPPERS/PRODUCERS
// lists like:
//   1. Rico Ace — 9M monthly, opening EsDeeKid Council House Rat tour
// A line can group several names with "/" (e.g. "diamond* / sk8star /
// Pz'"), confirmed live -- each becomes its own candidate. Only the name
// before the first " — "/" - " is kept; everything after is Grok's own
// reasoning text, not part of the name.
const TV_BOARD_LINE = /^\d+\.\s*(.+?)\s+[—-]\s+.+$/;

export function parseTvBoard(messages) {
  const names = new Map(); // lowercase -> as-written casing
  for (const message of messages) {
    for (const line of (message.content || "").split("\n")) {
      const match = line.match(TV_BOARD_LINE);
      if (!match) continue;
      for (const part of match[1].split("/")) {
        const trimmed = part.trim();
        if (trimmed) names.set(trimmed.toLowerCase(), trimmed);
      }
    }
  }
  return [...names.values()];
}

// Trending Tuesdays' data source: the most recent RAPPERS board message
// only (not every one in the fetched window -- the board refreshes
// daily, so anything older is stale and would mix names into a chart
// that's supposed to be "right now"). Only lines that carry a real
// listener figure Grok already researched (e.g. "9M monthly", "840k")
// are usable -- this never invents a number, so a rapper whose line has
// none is simply not eligible for the chart, not estimated.
const NUMBERED_LINE = /^\d+\.\s*(.+?)\s+[—-]\s+(.+)$/;
const STREAMS_TOKEN = /(\d+(?:\.\d+)?)\s*([MmKk])\b/;

export function parseTvRapperStreams(messages) {
  const rapperMessage = messages.find((m) => /\*\*RAPPERS\*\*/.test(m.content || ""));
  if (!rapperMessage) return [];

  const content = rapperMessage.content;
  const afterHeader = content.slice(content.search(/\*\*RAPPERS\*\*/));

  const results = [];
  for (const line of afterHeader.split("\n")) {
    const lineMatch = line.match(NUMBERED_LINE);
    if (!lineMatch) continue;
    const [, namePart, reason] = lineMatch;

    const streamsMatch = reason.match(STREAMS_TOKEN);
    if (!streamsMatch) continue;
    const [, num, unit] = streamsMatch;
    const multiplier = unit.toUpperCase() === "M" ? 1_000_000 : 1_000;

    // A "/"-grouped line ("A / B / C — reason") rarely carries a figure
    // that's genuinely shared across all of them in practice -- if one
    // ever does, credit the first name rather than guessing it applies
    // to the others too.
    const name = namePart.split("/")[0].trim();
    if (!name) continue;

    results.push({
      name,
      streamsLabel: `${num}${unit.toUpperCase()}`,
      streamsValue: parseFloat(num) * multiplier,
    });
  }
  return results;
}

// Posts a message (plain content and/or embeds) to a channel. Validated
// live via Composio's DISCORDBOT_CREATE_MESSAGE against the real
// #admin-general channel.
export async function postMessage(channelId, { content, embeds } = {}) {
  return runTool(
    "DISCORDBOT_CREATE_MESSAGE",
    { channel_id: channelId, ...(content ? { content } : {}), ...(embeds ? { embeds } : {}) },
    config.discord.connectedAccountId || undefined
  );
}

export async function postToAdminChannel(message) {
  if (!config.discord.adminChannelId) throw new Error("DISCORD_ADMIN_CHANNEL_ID missing");
  return postMessage(config.discord.adminChannelId, message);
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

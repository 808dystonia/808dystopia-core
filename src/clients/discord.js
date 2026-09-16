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

// #raptoonz: Grok posts one AI-generated rapper x cartoon-style mashup
// image per message (image attached, caption "RAPTOONZ: {rapper} —
// {style}") -- see parseRaptoonzPost().
export async function listRaptoonzChannelMessages(limit = 25) {
  if (!config.discord.raptoonzChannelId) throw new Error("DISCORD_RAPTOONZ_CHANNEL_ID missing");
  return listChannelMessages(config.discord.raptoonzChannelId, limit);
}

// #ps2: a curated photo of a female rapper/artist per message (image
// attached, caption "**{ARTIST}** {vibe} — {look}") -- see
// parseBoxArtPosts().
export async function listBoxArtChannelMessages(limit = 25) {
  if (!config.discord.boxartChannelId) throw new Error("DISCORD_BOXART_CHANNEL_ID missing");
  return listChannelMessages(config.discord.boxartChannelId, limit);
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

// Any TikTok video link pasted anywhere in #tv (no fixed section/format --
// scans every message) -- a curated pool for the Reel pipeline (see
// reels/2-find-video.js's own doc comment for why this exists: TikTok
// blocks automated per-artist search/profile listing, so sourcing here
// relies on someone -- Grok or a human -- pasting a specific video link
// instead). Stripped of query params so the same clip re-shared with
// different tracking params still dedupes to one URL.
const TIKTOK_VIDEO_URL = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi;

export function parseTikTokUrls(messages) {
  const urls = new Set();
  for (const message of messages) {
    const matches = (message.content || "").match(TIKTOK_VIDEO_URL) || [];
    for (const url of matches) urls.add(url);
  }
  return [...urls];
}

// #raptoonz: each usable message has an attached image and a caption of
// the form "RAPTOONZ: {rapper} — {cartoon style}" (em dash or hyphen).
// The style is freeform -- whatever show Grok names -- not checked
// against a fixed list, so a new one never needs a code change. Messages
// missing either the caption format or an attachment are skipped rather
// than guessed at. Returns candidates newest-first (messages are already
// sorted that way); dedup against the Sheet log happens by messageId in
// raptoonz/1-get-candidate.js, same shape as the Reel pipeline's own
// videoId dedup.
//
// NOT yet confirmed live: this assumes Discord's standard message
// attachment shape (message.attachments[].url) passes through
// DISCORDBOT_LIST_MESSAGES unchanged, matching how this file's other
// parsers already found the raw REST shape preserved rather than
// remapped. Confirm against Grok's first real post.
const RAPTOONZ_CAPTION = /^RAPTOONZ:\s*(.+?)\s*[—-]\s*(.+)$/i;

export function parseRaptoonzPosts(messages) {
  const results = [];
  for (const message of messages) {
    const match = (message.content || "").trim().match(RAPTOONZ_CAPTION);
    if (!match) continue;
    const imageUrl = message.attachments?.[0]?.url;
    if (!imageUrl) continue;
    results.push({ messageId: message.id, rapper: match[1].trim(), style: match[2].trim(), imageUrl });
  }
  return results;
}

// #ps2: confirmed live against the real channel -- each usable message is
// one photo with a caption whose leading **bold** span is the artist name,
// followed by the vibe and a short description of the look:
//   **COI LERAY** Y2K — white crop + pink LV bag
//   **CARDI B** SEXY — red jewels + feathers + tongue
// Only the name is used; the rest is the curator's own note about the
// photo, not part of the cover.
//
// Each batch is also announced with a header message carrying the same
// bold-first-span shape but no attachment ("**PS2 BATCH 2026-09-15
// FRESH** — 6 artists, Y2K/sexy only, pool lock"), so requiring an
// attachment is what keeps the header out rather than a special case for
// it. Dedup against the Sheet log happens by messageId in
// boxart/1-get-candidate.js, same shape as RapToonz's own messageId dedup.
const BOXART_CAPTION = /^\*\*(.+?)\*\*/;

export function parseBoxArtPosts(messages) {
  const results = [];
  for (const message of messages) {
    const match = (message.content || "").trim().match(BOXART_CAPTION);
    if (!match) continue;
    const imageUrl = message.attachments?.[0]?.url;
    if (!imageUrl) continue;
    const artist = match[1].trim();
    if (!artist) continue;
    results.push({ messageId: message.id, artist, imageUrl });
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

// Step 1: pull the newest unused article from Discord #underground-news,
// checked against the Google Sheet log. Falls back to next-newest unused;
// returns null if none are unused — the caller skips posting for the day.
import { listHeatChannelMessages } from "../clients/discord.js";
import { readLogRows } from "../clients/googleSheets.js";

const URL_RE = /https?:\/\/\S+/i;

function extractUrl(message) {
  const fromContent = message.content?.match(URL_RE)?.[0];
  const embed = message.embeds?.[0];
  const fromEmbed = fromContent ? null : (embed?.url || embed?.description?.match(URL_RE)?.[0]);
  const raw = fromContent || fromEmbed;
  return raw ? raw.replace(/[)\]>.,]+$/, "") : null;
}

function toArticle(message) {
  const url = extractUrl(message);
  return {
    messageId: message.id,
    key: url || message.id,
    url,
    text: message.content || message.embeds?.[0]?.description || "",
    timestamp: message.timestamp,
  };
}

export async function selectArticle() {
  const [messages, logRows] = await Promise.all([
    listHeatChannelMessages(),
    readLogRows(),
  ]);

  const usedKeys = new Set(
    logRows.filter((row) => row.status === "posted").map((row) => row.articleKey)
  );

  for (const message of messages) {
    const article = toArticle(message);
    if (!usedKeys.has(article.key)) return article;
  }
  return null;
}

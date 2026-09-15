// Step 1: pick the newest Grok-generated rapper x cartoon-style mashup
// from #raptoonz that hasn't been pinned yet. Grok handles the actual
// image generation (posts one image per message, captioned "RAPTOONZ:
// {rapper} — {style}") -- see clients/discord.js's parseRaptoonzPosts for
// the exact format. Dedup is by Discord message id, same shape as the
// Reel pipeline's own videoId dedup: a stable, non-drifting key, unlike
// the rapper+style text pair (which can't tell two distinct generations
// of the same pairing apart).
import { listRaptoonzChannelMessages, parseRaptoonzPosts } from "../clients/discord.js";
import { readRaptoonzLogRows, isRaptoonzMessageAlreadyPosted } from "../clients/googleSheets.js";

export async function getCandidate() {
  const messages = await listRaptoonzChannelMessages();
  const posts = parseRaptoonzPosts(messages); // newest-first, same order as messages
  if (posts.length === 0) return null;

  const logRows = await readRaptoonzLogRows();
  return posts.find((post) => !isRaptoonzMessageAlreadyPosted(logRows, post.messageId)) || null;
}

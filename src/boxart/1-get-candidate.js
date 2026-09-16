// Step 1: newest curated photo drop in #boxart that hasn't been turned
// into a cover yet. Same shape as RapToonz's own candidate step -- a
// human (or Grok) drops a photo + "BOXART: {Artist Name}" caption, this
// pipeline just picks up the newest unused one.
import { listBoxArtChannelMessages, parseBoxArtPosts } from "../clients/discord.js";
import { readBoxArtLogRows, isBoxArtMessageAlreadyPosted } from "../clients/googleSheets.js";

export async function getCandidate() {
  const messages = await listBoxArtChannelMessages();
  const posts = parseBoxArtPosts(messages);
  if (posts.length === 0) return null;

  const logRows = await readBoxArtLogRows();
  return posts.find((post) => !isBoxArtMessageAlreadyPosted(logRows, post.messageId)) || null;
}

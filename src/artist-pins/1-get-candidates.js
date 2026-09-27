// Step 1: who's eligible for a His/Her Underground pin right now. The
// pool is Grok's 808 TV board in #reels (src/clients/discord.js's
// parseTvBoardByGender) -- only names listed under an explicit
// **MALE**/**FEMALE** label, so a board is never picked by guessing at
// someone's gender. Recent pins put an artist on cooldown so the boards
// rotate instead of repeating the same few faces.
import { listReelsChannelMessages, parseTvBoardByGender } from "../clients/discord.js";

// Short on purpose: at 3 pins a day per board the labelled pool is small
// (5 women on the 9/27 board). Repeats still need a never-used photo.
export const COOLDOWN_DAYS = 7;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A pending (uncertain) claim counts too: it may well have posted.
export function onCooldown(artist, posts, now = new Date()) {
  const cutoff = now.getTime() - COOLDOWN_DAYS * 86400000;
  return Object.values(posts || {}).some(
    (post) => post.artist?.toLowerCase() === artist.toLowerCase() && Date.parse(post.startedAt) >= cutoff
  );
}

export function eligibleArtists(pool, posts, now = new Date()) {
  return shuffle(pool.filter((entry) => !onCooldown(entry.name, posts, now)));
}

export async function getCandidates(gender, posts) {
  // Several days of boards, not just today's, so the pool is wider.
  const messages = await listReelsChannelMessages(100);
  const pool = parseTvBoardByGender(messages)[gender] || [];
  return eligibleArtists(pool, posts);
}

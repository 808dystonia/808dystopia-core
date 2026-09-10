// Step 1: pull candidate stories from Discord #underground-news, newest
// first. Each "Morning Heat" message bundles several bulleted stories with
// no source URL, so a candidate is one bullet, not one message.
//
// This step can no longer resolve "the next unused one" by itself: dedup
// needs the artist/title Gemini extracts (step 2), which isn't known until
// a candidate is classified. So this just returns the ordered candidate
// list; index.js loops through it, classifying each and checking the log,
// until one isn't a repeat (or the list runs out and the day is skipped).
import { listHeatChannelMessages, splitIntoStories } from "../clients/discord.js";

export async function getCandidates() {
  const messages = await listHeatChannelMessages();
  return splitIntoStories(messages);
}

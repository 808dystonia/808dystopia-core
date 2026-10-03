// Step 1: pull candidate stories from Discord #underground-news, newest
// first. Each "Morning Heat" message bundles several bulleted stories with
// no source URL, so a candidate is one bullet, not one message.
//
// This step can no longer resolve "the next unused one" by itself: dedup
// needs the artist/title step 2 extracts, which isn't known until
// a candidate is classified. So this just returns the ordered candidate
// list; index.js loops through it, classifying each and checking the log,
// until one isn't a repeat (or the list runs out and the day is skipped).
import { listHeatChannelMessages, splitIntoStories } from "../clients/discord.js";

// "Just dropped" carousels get the most real comments, so stories that
// read like a new release and are under 72 hours old are tried first.
// Everything else keeps its newest-first order behind them, so an old
// drop never jumps ahead of today's news.
const RELEASE_WORDS = /\b(drop(s|ped|ping)?|album|ep|mixtape|tape|project|deluxe|lp|out now|releas(e|es|ed|ing))\b/i;
const FRESH_DROP_MS = 72 * 60 * 60 * 1000;

export function prioritizeDrops(stories, now = new Date()) {
  const isFreshDrop = (story) =>
    RELEASE_WORDS.test(story.text) && now - new Date(story.timestamp) <= FRESH_DROP_MS;
  return [...stories.filter(isFreshDrop), ...stories.filter((story) => !isFreshDrop(story))];
}

export async function getCandidates() {
  const messages = await listHeatChannelMessages();
  return prioritizeDrops(splitIntoStories(messages));
}

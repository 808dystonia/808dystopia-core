// Step 2: DeepSeek selects and summarizes the genuinely notable
// underground/hip-hop stories from today's pooled RSS articles —
// DeepSeek never sees the open web itself here, only the real fetched
// titles from step 1, so it's summarizing/selecting real content, not
// generating news from nothing (see the conversation that led to this
// design: DeepSeek has no live search, unlike Grok).
//
// Formats output to match the exact shape the carousel pipeline's own
// splitIntoStories() already parses from the morning Grok digest ("• "
// bulleted lines, source cited inline in parens) — built in code from
// DeepSeek's structured {summary, source} pairs rather than trusting the
// model to get the literal bullet punctuation right every time.
import { classifyWithDeepSeek } from "../clients/deepseek.js";

const MAX_STORIES = 6;

function buildPrompt(articles) {
  const list = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
    .join("\n");

  return `You are selecting news for 808 Dystopia, an UNDERGROUND hip-hop and producer-focused news page — not a mainstream chart/celebrity outlet. Read the list of real, recently-published article titles below and return ONLY a JSON object (no markdown, no other text) with this field:

- stories: an array of up to ${MAX_STORIES} objects, each {"summary": string, "source": string}. "summary" is a short, factual one-sentence description based ONLY on the article's title — do not invent details the title doesn't support. "source" is the exact source name from the list (e.g. "XXL").

Prioritize: independent/underground rappers and producers, mixtape and underground album/EP drops, beat/production culture, underground scene news (local scenes, indie labels, emerging artists). Deprioritize and generally EXCLUDE mainstream A-list celebrity gossip, legal/court news about already-famous major-label artists, mainstream award shows (Grammys, Billboard Honors, and similar), and generic pop-culture crossover stories — unless the title gives it a clear, direct underground/producer angle. When in doubt, exclude rather than include.

Multiple articles about the exact same real-world event (e.g. the same court case, the same release) should become ONE story, not one per source — pick the clearest title and cite that source. Skip anything that isn't genuinely rap/hip-hop news at all (unrelated topics, festival ads with no real news value). It's fine to return fewer stories, or an empty array, on a day with little genuine underground news — never pad with mainstream filler just to fill the count.

Articles:
${list}

Return ONLY the JSON object.`;
}

export async function buildDigest(articles) {
  if (articles.length === 0) return [];

  const result = await classifyWithDeepSeek(buildPrompt(articles));
  const stories = Array.isArray(result.stories) ? result.stories : [];
  return stories
    .filter((s) => s.summary && s.source)
    .slice(0, MAX_STORIES)
    .map((s) => `${s.summary} (${s.source})`);
}

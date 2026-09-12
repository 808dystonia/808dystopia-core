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

  return `You are selecting the most notable underground/hip-hop rap news from a pool of real, recently-published article titles for a Discord news digest. Read the list below and return ONLY a JSON object (no markdown, no other text) with this field:

- stories: an array of up to ${MAX_STORIES} objects, each {"summary": string, "source": string}. "summary" is a short, factual one-sentence description based ONLY on the article's title — do not invent details the title doesn't support. "source" is the exact source name from the list (e.g. "XXL"). Multiple articles about the exact same real-world event (e.g. the same court case, the same release) should become ONE story, not one per source — pick the clearest title and cite that source. Skip anything that isn't genuinely hip-hop/rap news (general culture pieces, unrelated topics, festival ads with no real news value). If nothing in the list is genuinely notable, return an empty array rather than padding with filler.

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

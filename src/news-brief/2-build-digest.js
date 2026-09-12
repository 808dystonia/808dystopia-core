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

  return `You are selecting news for 808 Dystopia, a hip-hop news page focused mostly on UNDERGROUND artists and producers, but not exclusively — mainstream news is welcome too, just as the minority of the mix. Read the list of real, recently-published article titles below and return ONLY a JSON object (no markdown, no other text) with this field:

- stories: an array of up to ${MAX_STORIES} objects, each {"summary": string, "source": string}. "summary" is a short, factual one-sentence description based ONLY on the article's title — do not invent details the title doesn't support. "source" is the exact source name from the list (e.g. "XXL").

Favor independent/underground rappers and producers, mixtape and underground album/EP drops, beat/production culture, and underground scene news (local scenes, indie labels, emerging artists). Aim for roughly 2 out of every 3 selected stories to be underground — mainstream stories (major-label artists, chart news, award shows, celebrity coverage) can fill the remaining third, especially when a day is light on underground news, but should stay the minority. If there aren't enough underground stories in the pool to hit that ratio, it's fine to lean more mainstream rather than pad with filler — just don't let mainstream crowd out underground stories that are actually there. Purely tabloid-style filler (celebrity gossip with no real music-news substance) can still be skipped in favor of a more substantive story, mainstream or underground.

Multiple articles about the exact same real-world event (e.g. the same court case, the same release) should become ONE story, not one per source — pick the clearest title and cite that source. Skip anything that isn't genuinely rap/hip-hop news at all (unrelated topics, festival ads with no real news value). It's fine to return fewer stories, or an empty array, on a slow news day — never pad with filler just to fill the count.

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

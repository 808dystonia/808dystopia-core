// Shared caption voice for carousels and Reels, modelled on the big rap
// news pages (rap, bars, kidstakeover, undergroundsound):
//
//   #Artist <hook> <1-2 emojis>
//
//   <1-3 sentences of context, with an emoji or two where it fits>
//
//   "<quote>" (when there is one)
//
//   <question to the audience> ⁉️ 🤔⬇️
//
//   <credit / @artist>
//
//   🎧 Follow @808dystopia for daily underground content
//   🌐 More underground news at the link in bio
//   👀 Who should we cover next?
//
// The AI writes only the hook, context and question, from the facts it's
// given and nothing else. Its context may carry 1-2 emojis (capped at 3);
// the hook and question emojis are chosen here by post type. Everything
// else is assembled here so it stays consistent and accurate. If the AI call fails
// or returns something unusable, the caller's plain fallback copy is used,
// so a caption never blocks a post.
import { generateJson } from "../clients/ai.js";

export const SIGN_OFF = [
  "🎧 Follow @808dystopia for daily underground content",
  "🌐 More underground news at the link in bio",
  "👀 Who should we cover next?",
].join("\n");

const LIMITS = { hook: 160, context: 450, question: 140 };

function buildPrompt(facts) {
  return `Write Instagram caption copy for 808 Dystopia, an underground hip-hop news page. Voice: a hip-hop news page talking to fans. Casual, hyped, short sentences, "y'all" is fine. Return ONLY a JSON object with:

- hook: ONE punchy sentence stating the news or what the clip shows, naming the artist. Under 140 characters.
- context: 1-3 short sentences adding the most interesting details from the facts, with 1-2 emojis placed where a fan page would put them (e.g. "it's crazy how much he grew 😵‍💫", "the beat goes so hard 🔥"). Use "" if the facts have nothing more to add.
- question: ONE question that gets fans commenting, about this specific post (e.g. "Have y'all run it yet?", "What do y'all think of the remix?"). Under 120 characters.

Rules:
- Use ONLY the facts below. Never add numbers, dates, chart positions, features, quotes or claims that aren't in them.
- No hashtags, no @mentions, no links. No emojis in hook or question (they're added separately).
- If the facts say the clip is someone else talking about the artist (a tutorial, reaction or review), the hook must say that plainly. Never imply the artist made or appears in it.

Facts:
"""
${facts}
"""`;
}

const EMOJI = /\p{Extended_Pictographic}(\u{FE0F}|\u{200D}\p{Extended_Pictographic})*/gu;
const MAX_CONTEXT_EMOJIS = 3;

const clean = (text) =>
  String(text || "")
    .replace(/[#@](\S+)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
const strip = (text) => clean(String(text || "").replace(EMOJI, "").replace(/\u{FE0F}/gu, ""));

// Keeps the AI's first few emojis in the context and drops the rest.
function limitEmojis(text, max) {
  let count = 0;
  return clean(String(text || "").replace(EMOJI, (m) => (++count <= max ? m : "")));
}

// Returns { hook, context, question } from the AI, or null when unusable.
export async function writeCopy(facts, generate = generateJson) {
  try {
    const result = await generate(buildPrompt(facts), "caption");
    const copy = { hook: strip(result.hook), context: limitEmojis(result.context, MAX_CONTEXT_EMOJIS), question: strip(result.question) };
    if (!copy.hook || !copy.question) return null;
    if (Object.entries(LIMITS).some(([key, max]) => copy[key].length > max)) return null;
    return copy;
  } catch (err) {
    console.log("caption copy:", err.message);
    return null;
  }
}

export function artistHashtag(artist) {
  const slug = String(artist || "").replace(/[^\p{L}\p{N}]/gu, "");
  return slug ? `#${slug}` : null;
}

// Turns the first mention of the artist in the hook into their hashtag
// ("Pixy just dropped" -> "#Pixy just dropped"), like the pages do.
export function tagArtist(hook, artist) {
  const tag = artistHashtag(artist);
  if (!tag || !artist) return hook;
  const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return hook.replace(new RegExp(`(^|[^\\p{L}\\p{N}#])${escaped}(?![\\p{L}\\p{N}])`, "iu"), (_, lead) => `${lead}${tag}`);
}

function endWith(sentence, emoji) {
  // Drops end punctuation, including inside a closing quote ('"Legacy."').
  const text = sentence.trim().replace(/[.!?]+(["”’']?)$/u, "$1").trim();
  return emoji ? `${text} ${emoji}` : text;
}

export function assembleCaption({ artist, hook, hookEmoji, context, quote, question, credit, handleLine }) {
  const blocks = [endWith(tagArtist(hook, artist), hookEmoji)];
  if (context) blocks.push(context);
  if (quote) blocks.push(quote);
  blocks.push(`${question.replace(/[\s?!.⁉️]+$/u, "")}⁉️ 🤔⬇️`);
  const tail = [credit, handleLine].filter(Boolean).join("\n");
  if (tail) blocks.push(tail);
  blocks.push(SIGN_OFF);
  return blocks.join("\n\n");
}

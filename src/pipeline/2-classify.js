// Step 2: classify a candidate story via Gemini into album_drop / diss /
// other, plus extracted fields.
import { classifyWithGemini } from "../clients/gemini.js";

const VALID_TYPES = new Set(["album_drop", "diss", "other"]);

function buildPrompt(text) {
  return `You are classifying a short underground hip-hop news blurb for an Instagram carousel post. Read the text and return ONLY a JSON object (no markdown, no other text) with these fields:

- type: one of "album_drop" (a new album/EP/mixtape/project release), "diss" (a diss track, beef, or feud moment), or "other" (anything else — general news, a show announcement, a history note, etc.)
- artist: the primary artist or producer this story is about. Use their normal stylized name as written in the text (preserve capitalization as given).
- title: the release title or diss track title. If type is "other" and there's no clear release/track title, use a short descriptive title for the story instead.
- tracklist: an array of track name strings, ONLY if type is "album_drop" AND the text lists specific track names. Otherwise an empty array.
- hook: a short, punchy 3-6 word phrase capturing the story, suitable for a bold headline on a graphic.

Text:
"""
${text}
"""

Return ONLY the JSON object.`;
}

export async function classifyArticle(candidate) {
  const result = await classifyWithGemini(buildPrompt(candidate.text));

  const type = VALID_TYPES.has(result.type) ? result.type : "other";
  return {
    type,
    artist: result.artist || "",
    title: result.title || "",
    tracklist: type === "album_drop" && Array.isArray(result.tracklist) ? result.tracklist : [],
    hook: result.hook || "",
  };
}

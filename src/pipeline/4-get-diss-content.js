// Step 4 (diss only): look up the track on Genius, pull the specific lyric
// line + community annotation, and run a confidence check on the match.
// Low confidence doesn't fail the article — it falls back to a generic
// context slide (handled by the caller, index.js). Lyric spelling is taken
// verbatim from Genius, never normalized.
// TODO: implement once GENIUS_ACCESS_TOKEN is available.

export async function getGeniusContent(_item, _type) {
  throw new Error("not implemented: getGeniusContent");
}

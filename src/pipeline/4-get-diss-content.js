// Step 4 (diss only): look up the track on Genius, pull the specific lyric
// line + community annotation, and run a confidence check on the match.
// Low confidence doesn't fail the article — the caller falls back to a
// generic context slide instead of the diss-lyric format. Lyric spelling
// (the referent's fragment) is taken verbatim from Genius, never normalized.
import { searchGenius, getReferents } from "../clients/genius.js";

// A referent needs a real explanation, not just a highlighted fragment with
// no annotation body, to be worth building a slide around.
const MIN_EXPLANATION_LENGTH = 20;

function isConfidentMatch(hit, artist, title) {
  const result = hit?.result;
  if (!result) return false;
  const artistMatch = result.primary_artist?.name?.toLowerCase().trim() === artist.toLowerCase().trim();
  const hitTitle = (result.title || "").toLowerCase();
  const wantTitle = title.toLowerCase();
  const titleMatch = hitTitle.includes(wantTitle) || wantTitle.includes(hitTitle);
  return artistMatch && titleMatch;
}

const MAX_EXPLANATION_LENGTH = 420;

// Safety net for the rare first paragraph that's still too long for the
// slide — cut at the last word boundary before the limit, not mid-word.
function truncate(text) {
  if (text.length <= MAX_EXPLANATION_LENGTH) return text;
  const cut = text.slice(0, MAX_EXPLANATION_LENGTH);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function pickBestReferent(referents) {
  const usable = referents.filter(
    (r) => (r.annotations?.[0]?.body?.plain || "").trim().length >= MIN_EXPLANATION_LENGTH
  );
  if (!usable.length) return null;
  usable.sort((a, b) => (b.annotations[0].votes_total || 0) - (a.annotations[0].votes_total || 0));
  return usable[0];
}

export async function getGeniusContent(artist, title) {
  const hits = await searchGenius(`${artist} ${title}`);
  const match = hits.find((hit) => isConfidentMatch(hit, artist, title));
  if (!match) return { confident: false };

  const referents = await getReferents(match.result.id);
  const best = pickBestReferent(referents);
  if (!best) return { confident: false };

  // Annotations are often multiple paragraphs; the first is reliably the
  // self-contained core explanation, and the slide has room for one. Later
  // paragraphs are supplementary and, worse, would get silently clipped
  // mid-sentence by the slide's fixed-height text box if included.
  const explanation = truncate(best.annotations[0].body.plain.split(/\n\s*\n/)[0].trim());

  return {
    confident: true,
    quote: best.fragment,
    explanation,
    sourceUrl: match.result.url,
  };
}

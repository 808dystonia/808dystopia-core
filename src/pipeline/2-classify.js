// Step 2: classify a candidate story via DeepSeek into album_drop / diss /
// other, plus extracted fields. "diss" is an umbrella for any notable
// lyric moment naming another artist (diss, cosign, shoutout, callout) —
// lyricTag says which; the pipeline routing/slide format is the same for
// all of them (step 4's Genius lyric+annotation lookup doesn't care about
// sentiment). For album_drop, the tracklist is upgraded to Spotify's
// authoritative track list when a confident match is found — DeepSeek's
// inferred tracklist (from a two-sentence blurb) is only the fallback.
// albumArtUrl also comes from that same Spotify lookup (null for
// non-album_drop, or when Spotify has no confident match).
// headlineLine1/2/Accent feed the cover slide's two-line headline for
// diss/other — album_drop doesn't need them since the renderer builds
// "ARTIST" / DROPS "TITLE" deterministically.
import { classifyWithDeepSeek } from "../clients/deepseek.js";
import { getAlbumInfo } from "../clients/spotify.js";

const VALID_TYPES = new Set(["album_drop", "diss", "other"]);

function buildPrompt(text) {
  return `You are classifying a short underground hip-hop news blurb for an Instagram carousel post. Read the text and return ONLY a JSON object (no markdown, no other text) with these fields:

- type: one of "album_drop" (a new album/EP/mixtape/project release), "diss" (any notable lyric moment naming or aimed at another artist — a diss, a cosign, a shoutout, or a callout), or "other" (anything else — general news, a show announcement, a history note, etc.)
- lyricTag: ONLY when type is "diss" — one of "DISS", "COSIGN", "SHOUTOUT", "CALLOUT" describing which kind of lyric moment it is. Omit or use "" otherwise.
- artist: the primary artist or producer this story is about. Use their normal stylized name as written in the text (preserve capitalization as given).
- title: the release title or track title the lyric moment is on. If type is "other" and there's no clear release/track title, use a short descriptive title for the story instead.
- tracklist: an array of track name strings, ONLY if type is "album_drop" AND the text lists specific track names. Otherwise an empty array.
- headlineLine1: ONLY when type is "diss" or "other" — a short 1-3 word first line for a bold two-line headline (usually the artist/subject name). Omit or use "" for album_drop.
- headlineLine2: ONLY when type is "diss" or "other" — the rest of the headline as a punchy 2-5 word phrase completing the thought (e.g. "DISSES TRAVIS SCOTT", "COMES TO LONDON", "COSIGNS NEW ARTIST"). Use each artist's one commonly recognized name consistently — never combine a real name with their nickname/alias into one phrase (e.g. "TRAVIS SCOTT", not "TRAVIS FLAME"). Omit or use "" for album_drop.
- headlineAccent: ONLY when type is "diss" or "other" — within headlineLine2, the name of the OTHER artist/subject being addressed (the target, not the verb — e.g. in "DISSES TRAVIS SCOTT" accent "TRAVIS SCOTT", never "DISSES"). If headlineLine2 has no such name (e.g. "COMES TO LONDON"), accent the most specific noun phrase instead (e.g. "LONDON"). Must be an exact substring of headlineLine2. Omit or use "" otherwise.
- context: when type is "other", OR type is "album_drop" and the text does NOT list specific track names — a 3-5 sentence expanded paragraph for the slide body, in a factual news-blurb tone. Elaborate naturally on what the text already says (spell out abbreviations, add a sentence of relevant framing/background you're confident about) — but do NOT invent specific facts the text doesn't support: no new dates, numbers, quotes, or claims about people/events not mentioned. If you don't have enough to responsibly expand it, it's fine to stay close to the original text rather than pad it. Omit or use "" otherwise (including for "album_drop" when the text does list track names).

Text:
"""
${text}
"""

Return ONLY the JSON object.`;
}

const VALID_LYRIC_TAGS = new Set(["DISS", "COSIGN", "SHOUTOUT", "CALLOUT"]);

export async function classifyArticle(candidate) {
  const result = await classifyWithDeepSeek(buildPrompt(candidate.text));

  const type = VALID_TYPES.has(result.type) ? result.type : "other";
  const artist = result.artist || "";
  const title = result.title || "";
  let tracklist = type === "album_drop" && Array.isArray(result.tracklist) ? result.tracklist : [];
  let albumArtUrl = null;

  if (type === "album_drop") {
    try {
      const info = await getAlbumInfo(artist, title);
      if (info.tracklist) tracklist = info.tracklist;
      albumArtUrl = info.albumArtUrl;
    } catch (err) {
      console.log("spotify album info:", err.message);
    }
  }

  const lyricTag = type === "diss" && VALID_LYRIC_TAGS.has(result.lyricTag) ? result.lyricTag : "DISS";

  // album_drop only needs context as a fallback for when neither the
  // source text nor Spotify has a tracklist (e.g. an unreleased/unlisted
  // album) — otherwise the tracklist slide would render with no rows.
  const needsContext = type === "other" || (type === "album_drop" && tracklist.length === 0);

  return {
    type,
    artist,
    title,
    tracklist,
    albumArtUrl,
    lyricTag,
    headlineLine1: result.headlineLine1 || artist,
    headlineLine2: result.headlineLine2 || "",
    headlineAccent: result.headlineAccent || "",
    context: needsContext ? result.context || "" : "",
  };
}

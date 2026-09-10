// Step 2: classify a candidate story via Gemini into album_drop / diss /
// other, plus extracted fields. "diss" is an umbrella for any notable
// lyric moment naming another artist (diss, cosign, shoutout, callout) —
// lyricTag says which; the pipeline routing/slide format is the same for
// all of them (step 4's Genius lyric+annotation lookup doesn't care about
// sentiment). For album_drop, the tracklist is upgraded to Spotify's
// authoritative track list when a confident match is found — Gemini's
// inferred tracklist (from a two-sentence blurb) is only the fallback.
// albumArtUrl also comes from that same Spotify lookup (null for
// non-album_drop, or when Spotify has no confident match).
import { classifyWithGemini } from "../clients/gemini.js";
import { getAlbumInfo } from "../clients/spotify.js";

const VALID_TYPES = new Set(["album_drop", "diss", "other"]);

function buildPrompt(text) {
  return `You are classifying a short underground hip-hop news blurb for an Instagram carousel post. Read the text and return ONLY a JSON object (no markdown, no other text) with these fields:

- type: one of "album_drop" (a new album/EP/mixtape/project release), "diss" (any notable lyric moment naming or aimed at another artist — a diss, a cosign, a shoutout, or a callout), or "other" (anything else — general news, a show announcement, a history note, etc.)
- lyricTag: ONLY when type is "diss" — one of "DISS", "COSIGN", "SHOUTOUT", "CALLOUT" describing which kind of lyric moment it is. Omit or use "" otherwise.
- artist: the primary artist or producer this story is about. Use their normal stylized name as written in the text (preserve capitalization as given).
- title: the release title or track title the lyric moment is on. If type is "other" and there's no clear release/track title, use a short descriptive title for the story instead.
- tracklist: an array of track name strings, ONLY if type is "album_drop" AND the text lists specific track names. Otherwise an empty array.
- hook: a short, punchy 3-6 word phrase capturing the story, suitable for a bold headline on a graphic.

Text:
"""
${text}
"""

Return ONLY the JSON object.`;
}

const VALID_LYRIC_TAGS = new Set(["DISS", "COSIGN", "SHOUTOUT", "CALLOUT"]);

export async function classifyArticle(candidate) {
  const result = await classifyWithGemini(buildPrompt(candidate.text));

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

  return { type, artist, title, tracklist, albumArtUrl, lyricTag, hook: result.hook || "" };
}

// Step 6: build the caption in the shared news-page voice (see
// src/captions/voice.js): a hook naming the artist, a little context, a
// question for the comments, the artist's IG handle, then the 808 sign-off.
// The full hashtag block still goes in the first comment. The IG handle
// comes from the artist's Genius profile (instagram_name); a miss just
// means no @-mention, never a guessed handle. If the AI copy is
// unavailable, the plain news line below is the hook.
import { getArtistInstagramHandle } from "../clients/genius.js";
import { writeCopy, assembleCaption } from "../captions/voice.js";

function toTitleCase(text) {
  return (text || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function firstSentence(text) {
  const match = (text || "").match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text || "").trim();
}

const DISS_VERBS = {
  DISS: "goes at",
  COSIGN: "cosigns",
  SHOUTOUT: "shouts out",
  CALLOUT: "calls out",
};

function buildContextLine(candidate, classified) {
  const title = toTitleCase(classified.title);

  if (classified.type === "album_drop" || classified.released) {
    return `${classified.artist} just dropped "${title}."`;
  }

  if (classified.type === "diss") {
    const verb = DISS_VERBS[classified.lyricTag] || DISS_VERBS.DISS;
    const target = classified.headlineAccent ? toTitleCase(classified.headlineAccent) : null;
    return target
      ? `${classified.artist} ${verb} ${target} on "${title}."`
      : `${classified.artist} on "${title}."`;
  }

  return firstSentence(classified.context) || candidate.text;
}

function artistHashtag(artist) {
  const slug = (artist || "").replace(/[^a-z0-9]/gi, "");
  return slug ? `#${slug}` : null;
}

const BASE_HASHTAGS = ["#hiphop", "#rap", "#hiphopnews", "#undergroundhiphop"];
const TYPE_HASHTAGS = {
  album_drop: ["#newmusic", "#albumdrop"],
  diss: ["#hiphopdrama"],
  other: [],
};

function buildHashtags(classified) {
  const type = classified.released ? "album_drop" : classified.type;
  const tags = [...BASE_HASHTAGS, ...(TYPE_HASHTAGS[type] || [])];
  const artistTag = artistHashtag(classified.artist);
  if (artistTag && !tags.includes(artistTag)) tags.push(artistTag);
  return tags.join(" ");
}

const HOOK_EMOJI = { album_drop: "💿🔥", diss: "‼️👀", other: "👀" };
const FALLBACK_QUESTIONS = {
  album_drop: "Have y'all checked it out yet",
  diss: "Who y'all got",
  other: "What do y'all think",
};

function captionKind(classified) {
  return classified.released ? "album_drop" : classified.type;
}

function factsFor(candidate, classified) {
  const lines = [
    `Artist: ${classified.artist}`,
    `Story type: ${captionKind(classified) === "album_drop" ? "new release" : classified.type === "diss" ? `lyric moment (${classified.lyricTag})` : "news"}`,
    `Title: ${classified.title}`,
    `Source text: ${candidate.text}`,
  ];
  if (classified.context) lines.push(`Background already written for the slide: ${classified.context}`);
  if (classified.tracklist?.length) lines.push(`Track count: ${classified.tracklist.length}`);
  return lines.join("\n");
}

export async function buildCaption({ candidate, classified }, { write = writeCopy } = {}) {
  const kind = captionKind(classified);
  const copy = await write(factsFor(candidate, classified));

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(classified.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const caption = assembleCaption({
    artist: classified.artist,
    hook: copy?.hook || buildContextLine(candidate, classified),
    hookEmoji: HOOK_EMOJI[kind],
    context: copy?.context || "",
    question: copy?.question || FALLBACK_QUESTIONS[kind] || FALLBACK_QUESTIONS.other,
    handleLine: instagramHandle ? `@${instagramHandle}` : "",
  });

  return {
    caption,
    hashtags: buildHashtags(classified),
    collaborator: instagramHandle,
  };
}

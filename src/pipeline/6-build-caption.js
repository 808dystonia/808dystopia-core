// Step 6: build the caption (a brief factual line, then @-mention the
// artist's IG handle when we have one, then "Follow for more.") and a
// separate hashtag block for the first comment. The IG handle comes from
// the artist's Genius profile (instagram_name) — Genius is already our
// artist source of record for photo/lyric lookups, and most working
// artists self-report their Instagram there. A miss just means no
// @-mention, never a guessed handle.
import { getArtistInstagramHandle } from "../clients/genius.js";

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

  if (classified.type === "album_drop") {
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
  const tags = [...BASE_HASHTAGS, ...(TYPE_HASHTAGS[classified.type] || [])];
  const artistTag = artistHashtag(classified.artist);
  if (artistTag && !tags.includes(artistTag)) tags.push(artistTag);
  return tags.join(" ");
}

export async function buildCaption({ candidate, classified }) {
  const contextLine = buildContextLine(candidate, classified);

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(classified.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const lines = [contextLine];
  if (instagramHandle) lines.push(`@${instagramHandle}`);
  lines.push("Follow for more.");

  return {
    caption: lines.join("\n\n"),
    hashtags: buildHashtags(classified),
  };
}

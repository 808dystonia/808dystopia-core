// Step 5: build the Reel caption in the shared news-page voice (see
// src/captions/voice.js): a hook saying what the clip is, a little context,
// the quote, a question for the comments, the credit, then the 808 sign-off.
// When the artist is in the clip (their own upload, an interview, a live
// set), the quote is credited to them and they get a collab invite. When
// it's someone else talking about the artist (a type-beat tutorial, a
// reaction, a review), the hook says so, the quote is credited to that
// creator, and the artist is only @-mentioned. highlight.reason is the AI's
// internal note on why it picked the moment, so it never appears.
import { getArtistInstagramHandle } from "../clients/genius.js";
import { writeCopy, assembleCaption } from "../captions/voice.js";
import { isNoCollabStory } from "../util/sensitiveContent.js";

const BASE_HASHTAGS = ["#hiphop", "#rap", "#undergroundhiphop", "#hiphopreels"];
const CONTENT_TYPE_HASHTAGS = {
  interview: ["#interview"],
  "beat breakdown": ["#beatbreakdown", "#producer"],
  performance: ["#liveperformance"],
  freestyle: ["#freestyle"],
  "studio session": ["#studiosession"],
  "livestream clip": ["#livestream", "#twitchclip"],
  "music video": ["#musicvideo"],
  "type beat tutorial": ["#typebeat", "#producer", "#beatmaking"],
  reaction: ["#reaction"],
  review: ["#review"],
};

function artistHashtag(artist) {
  const slug = (artist || "").replace(/[^a-z0-9]/gi, "");
  return slug ? `#${slug}` : null;
}

function buildHashtags(video) {
  const tags = [...BASE_HASHTAGS, ...(CONTENT_TYPE_HASHTAGS[video.contentType] || [])];
  const artistTag = artistHashtag(video.artist);
  if (artistTag && !tags.includes(artistTag)) tags.push(artistTag);
  return tags.join(" ");
}

const PLATFORM_LABELS = { tiktok: "TikTok", twitch: "Twitch" };

const CONTENT_TYPE_LABELS = {
  interview: "in an interview",
  "beat breakdown": "breaking down a beat",
  performance: "live",
  freestyle: "freestyling",
  "studio session": "in the studio",
  "livestream clip": "on stream",
  "music video": "in the video",
};

// Fallback hooks when the AI copy is unavailable. "About" content always
// says what it is.
const ABOUT_HOOKS = {
  "type beat tutorial": (artist) => `A producer broke down how to make beats in the style of ${artist}`,
  reaction: (artist) => `A creator reacted to ${artist}`,
  review: (artist) => `A creator broke down ${artist}'s music`,
};

const HOOK_EMOJI = {
  interview: "🎙️👀",
  performance: "🎤🔥",
  freestyle: "🎤🔥",
  "studio session": "🎛️🔥",
  "music video": "🎬🔥",
  "livestream clip": "📺👀",
  "beat breakdown": "🎛️🔥",
  "type beat tutorial": "🎛️👀",
  reaction: "👀😳",
  review: "📝👀",
};

const FALLBACK_QUESTIONS = {
  "type beat tutorial": "Could y'all make a beat like this",
  reaction: "Do y'all agree with the reaction",
  review: "Do y'all agree",
  interview: "What do y'all think",
};

const MAX_QUOTE_LENGTH = 220;

// Transcript quotes are often several run-on Whisper lines, so this
// collapses whitespace, drops wrapping quote marks, and cuts long quotes
// at a word boundary.
export function cleanQuote(quote) {
  let text = String(quote || "").replace(/\s+/g, " ").trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  if (text.length <= MAX_QUOTE_LENGTH) return text;
  text = text.slice(0, MAX_QUOTE_LENGTH);
  const lastSpace = text.lastIndexOf(" ");
  if (lastSpace > MAX_QUOTE_LENGTH / 2) text = text.slice(0, lastSpace);
  return `${text.replace(/[\s,;:.!?-]+$/, "")}…`;
}

function factsFor(video, quote, about) {
  const platform = PLATFORM_LABELS[video.source] || "YouTube";
  return [
    `Artist: ${video.artist}`,
    `Clip type: ${video.contentType}`,
    about
      ? `Who's in it: ${video.channelTitle || "another creator"}, talking about ${video.artist}. ${video.artist} is NOT in this clip.`
      : `Who's in it: ${video.artist}`,
    `Video title: ${video.title || ""}`,
    `Posted by: ${video.channelTitle || platform} on ${platform}`,
    quote ? `What's said in the clip: "${quote}"` : "",
  ].filter(Boolean).join("\n");
}

export async function buildReelCaption(video, { write = writeCopy } = {}) {
  const quote = cleanQuote(video.highlight?.quote);
  const about = video.relation === "about";
  const platform = PLATFORM_LABELS[video.source] || "YouTube";
  const source = video.channelTitle || platform;
  const copy = await write(factsFor(video, quote, about));

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(video.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const context = CONTENT_TYPE_LABELS[video.contentType];
  const fallbackHook = about
    ? (ABOUT_HOOKS[video.contentType] || ((artist) => `A creator talked about ${artist}`))(video.artist)
    : `${video.artist}${context ? ` ${context}` : ""}`;

  const caption = assembleCaption({
    artist: video.artist,
    hook: copy?.hook || fallbackHook,
    hookEmoji: HOOK_EMOJI[video.contentType] || "👀🔥",
    context: copy?.context || "",
    quote: quote ? `“${quote}” — ${about ? source : video.artist}` : "",
    question: copy?.question || FALLBACK_QUESTIONS[video.contentType] || "What do y'all think",
    credit: `🎥 Via ${source} (${platform})${about ? ` · not ${video.artist}'s own upload` : ""}`,
    handleLine: instagramHandle ? (about ? `Artist: @${instagramHandle}` : `@${instagramHandle}`) : "",
  });

  return {
    caption,
    hashtags: buildHashtags(video),
    // On-screen text burned onto the clip in step 4.
    overlay: copy?.overlay || fallbackHook,
    // Only invite the artist to collab on content they're actually in.
    collaborator: about || isNoCollabStory(video.title, quote) ? null : instagramHandle,
  };
}

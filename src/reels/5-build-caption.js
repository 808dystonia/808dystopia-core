// Step 5: build the Reel caption. It always says plainly what the clip is.
// When the artist is in it (their own upload, an interview, a live set),
// it leads with their words (step 3's highlight.quote, cleaned up) and
// credits them. When it's someone else talking about the artist (a
// type-beat tutorial, a reaction, a review), it says so first, credits the
// quote to that creator, and only @-mentions the artist -- no collab
// invite. highlight.reason is the AI's internal note on why it picked the
// moment, so it never appears in the caption.
import { getArtistInstagramHandle } from "../clients/genius.js";

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

// Lead lines for content about the artist rather than by or featuring them.
const ABOUT_LEADS = {
  "type beat tutorial": (artist) => `🎛 Type beat tutorial: a producer breaks down how to make beats in the style of ${artist}.`,
  reaction: (artist) => `👀 Reaction: a creator reacts to ${artist}.`,
  review: (artist) => `📝 Review: a creator breaks down ${artist}'s music.`,
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

// Who said it and where the clip came from: the featured artist plus
// whoever posted it (video.channelTitle -- the YouTube channel, Twitch
// broadcaster, or TikTok uploader).
function creditLine(video) {
  const platform = PLATFORM_LABELS[video.source] || "YouTube";
  const source = video.channelTitle || platform;
  const context = CONTENT_TYPE_LABELS[video.contentType];
  return `— ${video.artist}${context ? `, ${context}` : ""} · 🎥 via ${source} (${platform})`;
}

function aboutLines(video, quote) {
  const platform = PLATFORM_LABELS[video.source] || "YouTube";
  const creator = video.channelTitle || platform;
  const lead = (ABOUT_LEADS[video.contentType] || ((artist) => `A creator talks about ${artist}.`))(video.artist);
  const lines = [lead];
  if (quote) lines.push(`“${quote}” — ${creator}`);
  lines.push(`🎥 via ${creator} (${platform}) · not ${video.artist}'s own upload`);
  return lines;
}

export async function buildReelCaption(video) {
  const quote = cleanQuote(video.highlight?.quote);
  const about = video.relation === "about";

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(video.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const lines = about ? aboutLines(video, quote) : [quote ? `“${quote}”` : `🎤 ${video.artist}`, creditLine(video)];
  if (instagramHandle) lines.push(about ? `Artist: @${instagramHandle}` : `@${instagramHandle}`);
  lines.push("Follow for more.");

  return {
    caption: lines.join("\n\n"),
    hashtags: buildHashtags(video),
    // Only invite the artist to collab on content they're actually in.
    collaborator: about ? null : instagramHandle,
  };
}

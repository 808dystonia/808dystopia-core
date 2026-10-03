// Step 5: build the Reel caption. It leads with the artist's own words
// (step 3's highlight.quote, cleaned up and capped), then a credit line
// saying who said it and where the footage came from. highlight.reason is
// the AI's internal note on why it picked the moment ("This is a
// self-contained, quotable..."), so it never appears in the caption.
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

export async function buildReelCaption(video) {
  const quote = cleanQuote(video.highlight?.quote);
  const lead = quote ? `“${quote}”` : `🎤 ${video.artist}`;

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(video.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const lines = [lead, creditLine(video)];
  if (instagramHandle) lines.push(`@${instagramHandle}`);
  lines.push("Follow for more.");

  return {
    caption: lines.join("\n\n"),
    hashtags: buildHashtags(video),
    collaborator: instagramHandle,
  };
}

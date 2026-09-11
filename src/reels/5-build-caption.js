// Step 5: build the Reel caption — factual, to-the-point, same tone as
// the news carousel's caption (src/pipeline/6-build-caption.js), no
// separate stylized voice guide. Simpler than the carousel's version: no
// per-type branching (album_drop/diss/other) — just one video per day, and
// step 3's highlight.reason is already a clean, one-sentence factual
// description of the moment (written for exactly this use), so this
// doesn't need its own DeepSeek call to restate it. highlight.quote is
// available but deliberately not quoted verbatim in the caption — it's
// often several run-on transcript lines stitched together, not
// caption-clean text — the reason line carries the caption instead.
import { getArtistInstagramHandle } from "../clients/genius.js";

const BASE_HASHTAGS = ["#hiphop", "#rap", "#undergroundhiphop", "#hiphopreels"];
const CONTENT_TYPE_HASHTAGS = {
  interview: ["#interview"],
  "beat breakdown": ["#beatbreakdown", "#producer"],
  performance: ["#liveperformance"],
  freestyle: ["#freestyle"],
  "studio session": ["#studiosession"],
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

export async function buildReelCaption(video) {
  const contextLine = video.highlight?.reason || `${video.artist} — ${video.contentType} highlight.`;

  let instagramHandle = null;
  try {
    instagramHandle = await getArtistInstagramHandle(video.artist);
  } catch (err) {
    console.log("genius instagram handle lookup:", err.message);
  }

  const lines = [contextLine];
  if (instagramHandle) lines.push(`@${instagramHandle}`);
  lines.push("Follow for more.");

  return {
    caption: lines.join("\n\n"),
    hashtags: buildHashtags(video),
  };
}

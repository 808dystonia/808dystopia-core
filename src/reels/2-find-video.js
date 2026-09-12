// Step 2: for a watchlist artist/producer, find one usable video — a
// performance, beat/preset breakdown, interview, or livestream clip. The
// watchlist only names who, not what, so this tries several content-type
// query variants per artist, in priority order, and returns the first
// candidate that passes the vetting checks below.
//
// Transcript/caption availability is NOT checked here (see clients/youtube.js
// for why third-party transcript access is dead) — step 3+ transcribes the
// downloaded video locally with Whisper instead, so any video qualifies.
// What IS checked, via videos.list status/contentDetails:
//   - not a live/upcoming broadcast (liveBroadcastContent === "none") —
//     this pipeline wants a finished clip, not an ongoing stream
//   - public, embeddable, fully processed (skips flagged/restricted/
//     removed/still-processing videos — these generally don't come back
//     as healthy status fields, which covers the spec's "skip anything
//     flagged/DMCA'd")
//   - a duration long enough to contain a real highlight and short enough
//     to keep local Whisper transcription (step 3) fast
//
// If YouTube turns up nothing usable, falls back to the artist's own
// Twitch clips (clients/twitch.js) as a secondary source — Twitch has no
// platform-wide clip search, only a channel-name lookup, so this only
// works when the artist has an active Twitch channel under a matching
// name. A Twitch clip is already short (well under our highlight-window
// limits), so it's returned in the exact same shape as a YouTube result
// (videoId/title/artist/contentType/durationSeconds/url) and needs no
// changes to steps 3-7 — a clip just becomes another `video` object,
// downloaded by its `url` like any other.
//
// Per-artist only: dedup against previously-used videos (never repost a
// clip) happens in reels/index.js against the Sheet log, same as the news
// pipeline's isAlreadyPosted — if this artist's pick turns out already
// logged, index.js falls back to the next watchlist artist rather than
// asking this function for a second video.
import { searchVideos, getVideoDetails } from "../clients/youtube.js";
import { findChannelId, getClips } from "../clients/twitch.js";

const CONTENT_TYPE_QUERIES = [
  (artist) => ({ label: "interview", query: `${artist} interview` }),
  (artist) => ({ label: "beat breakdown", query: `${artist} beat breakdown` }),
  (artist) => ({ label: "performance", query: `${artist} live performance` }),
  (artist) => ({ label: "freestyle", query: `${artist} freestyle` }),
  (artist) => ({ label: "studio session", query: `${artist} studio session` }),
];

const MIN_DURATION_SECONDS = 45;
// Kept modest (not the 45 min originally planned) because step 3 transcribes
// the entire video locally with CPU-only Whisper inside a time-boxed GitHub
// Actions job -- a much longer video risks blowing the job timeout just to
// pick one highlight.
const MAX_DURATION_SECONDS = 20 * 60;

function isUsable(details) {
  return (
    details.liveBroadcastContent === "none" &&
    details.uploadStatus === "processed" &&
    details.privacyStatus === "public" &&
    details.embeddable &&
    details.durationSeconds >= MIN_DURATION_SECONDS &&
    details.durationSeconds <= MAX_DURATION_SECONDS
  );
}

// Twitch clips are inherently short (well under YouTube's 45s floor above
// -- most are 15-60s), so this uses a lower minimum matching step 3's own
// MIN_CLIP_SECONDS: anything shorter can't satisfy a valid highlight
// window anyway, regardless of source.
const TWITCH_MIN_DURATION_SECONDS = 15;

async function findTwitchClip(artistHandle) {
  const channelId = await findChannelId(artistHandle);
  if (!channelId) return null;

  const clips = await getClips(channelId, 20);
  const usable = clips.find((clip) => clip.duration >= TWITCH_MIN_DURATION_SECONDS);
  if (!usable) return null;

  return {
    videoId: usable.id,
    title: usable.title,
    channelTitle: usable.broadcaster_name,
    publishedAt: usable.created_at,
    url: usable.url,
    durationSeconds: usable.duration,
    artist: artistHandle,
    contentType: "livestream clip",
    source: "twitch",
  };
}

export async function findVideo(artistHandle) {
  for (const buildQuery of CONTENT_TYPE_QUERIES) {
    const { label, query } = buildQuery(artistHandle);
    const results = await searchVideos(query, { maxResults: 5 });
    if (results.length === 0) continue;

    const details = await getVideoDetails(results.map((r) => r.videoId));
    const usable = details.find(isUsable);
    if (usable) return { ...usable, artist: artistHandle, contentType: label };
  }

  try {
    const twitchClip = await findTwitchClip(artistHandle);
    if (twitchClip) return twitchClip;
  } catch (err) {
    console.log(`twitch fallback for ${artistHandle} failed:`, err.message);
  }
  return null;
}

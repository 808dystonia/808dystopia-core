// Step 2: for a watchlist artist/producer, find one usable YouTube video —
// a performance, beat/preset breakdown, interview, or livestream clip. The
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
// Per-artist only: dedup against previously-used videos (never repost a
// clip) happens in reels/index.js against the Sheet log, same as the news
// pipeline's isAlreadyPosted — if this artist's pick turns out already
// logged, index.js falls back to the next watchlist artist rather than
// asking this function for a second video.
import { searchVideos, getVideoDetails } from "../clients/youtube.js";

const CONTENT_TYPE_QUERIES = [
  (artist) => ({ label: "interview", query: `${artist} interview` }),
  (artist) => ({ label: "beat breakdown", query: `${artist} beat breakdown` }),
  (artist) => ({ label: "performance", query: `${artist} live performance` }),
  (artist) => ({ label: "freestyle", query: `${artist} freestyle` }),
  (artist) => ({ label: "studio session", query: `${artist} studio session` }),
];

const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 45 * 60;

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

export async function findVideo(artistHandle) {
  for (const buildQuery of CONTENT_TYPE_QUERIES) {
    const { label, query } = buildQuery(artistHandle);
    const results = await searchVideos(query, { maxResults: 5 });
    if (results.length === 0) continue;

    const details = await getVideoDetails(results.map((r) => r.videoId));
    const usable = details.find(isUsable);
    if (usable) return { ...usable, artist: artistHandle, contentType: label };
  }
  return null;
}

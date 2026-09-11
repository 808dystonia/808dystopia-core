// YouTube Data API v3 — video search + status/detail checks (step 2).
//
// Free tier: 10,000 quota units/day (search.list costs 100/call, videos.list
// costs 1/call) — comfortably enough for one request/day.
//
// Transcript access does NOT come from this API. Confirmed live (see repo
// history): the official captions.download endpoint only works for the API
// key's own channel, the unofficial timedtext endpoint now returns an empty
// body for third-party videos, HTML scraping no longer exposes captionTracks
// in the unauthenticated watch-page response, and the internal InnerTube
// player endpoint now rejects requests without a proof-of-origin token.
// All free/unofficial routes to a third-party transcript are dead as of
// 2026. Step 3+ instead downloads the video and transcribes it locally with
// Whisper — so this client has no getTranscript(); it only finds and
// vets candidate videos.
import { config } from "../config.js";

const API = "https://www.googleapis.com/youtube/v3";

export async function searchVideos(query, { maxResults = 5 } = {}) {
  const key = config.youtube.apiKey;
  if (!key) throw new Error("YOUTUBE_API_KEY missing");

  const url = `${API}/search?${new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    key,
  })}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`youtube search ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  return (json.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }));
}

// ISO 8601 duration (e.g. "PT21M5S") -> seconds.
function parseIsoDuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

// Fetches status/content details for up to 50 video IDs in one call (the
// API's own per-request cap) and folds in the fields step 2 needs to skip
// live broadcasts, unembeddable, non-public, or unprocessed videos.
export async function getVideoDetails(videoIds) {
  const key = config.youtube.apiKey;
  if (!key) throw new Error("YOUTUBE_API_KEY missing");
  if (videoIds.length === 0) return [];

  const url = `${API}/videos?${new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: videoIds.join(","),
    key,
  })}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`youtube videos ${res.status} ${JSON.stringify(json).slice(0, 300)}`);

  return (json.items || []).map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    liveBroadcastContent: item.snippet.liveBroadcastContent,
    durationSeconds: parseIsoDuration(item.contentDetails.duration),
    uploadStatus: item.status.uploadStatus,
    privacyStatus: item.status.privacyStatus,
    embeddable: item.status.embeddable,
    url: `https://www.youtube.com/watch?v=${item.id}`,
  }));
}

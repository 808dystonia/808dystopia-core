// YouTube Data API v3 — video search (step 2) and transcript access
// (needed by both step 2, to confirm a candidate video has one, and
// step 3, to feed it to DeepSeek).
//
// Free tier: 10,000 quota units/day (search.list costs 100/call) —
// comfortably enough for one request/day. The real risk is transcript
// access, not quota: the official captions.download endpoint generally
// only returns captions for videos the API key's own channel owns.
// Pulling a third-party video's auto-captions typically means the
// unofficial public timedtext endpoint instead — not an officially
// supported API, and not guaranteed stable. Confirm this actually works
// before building step 2/3 around it.
import { config } from "../config.js";

export async function searchVideos(_query) {
  if (!config.youtube.apiKey) throw new Error("YOUTUBE_API_KEY missing");
  throw new Error("not implemented: searchVideos");
}

export async function getTranscript(_videoId) {
  throw new Error("not implemented: getTranscript");
}

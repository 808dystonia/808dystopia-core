// Step 1: pull unposted Reel content requests from Discord #reels,
// newest first. Requests are plain lines in the format
// "Artist — content type" (e.g. "Pierre Bourne — beat breakdown"),
// posted by a human — not a bot digest like the news pipeline's
// #underground-news, so the parsing here will be simpler than
// splitIntoStories() over there.
// TODO: implement once the #reels channel's real message format is
// confirmed live (reuses the same Composio Discord connected account as
// the news pipeline, just a different channel id).
export async function getReelRequests() {
  throw new Error("not implemented: getReelRequests");
}

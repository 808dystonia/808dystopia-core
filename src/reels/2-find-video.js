// Step 2: for the selected request, find a matching YouTube (or other
// accessible archive) video of that artist/producer doing that specific
// content type (performance, beat/preset breakdown, Twitch/Kick clip,
// interview, IG Live snippet). Only a video with an available
// transcript/captions is usable — no speech-to-text step. Skip anything
// already flagged/DMCA'd.
// TODO: implement once YOUTUBE_API_KEY is available. Needs an early
// spike on transcript access specifically: the official captions.download
// endpoint generally only works for captions the API key's own channel
// owns, so pulling a third-party video's auto-captions may need the
// unofficial public timedtext endpoint instead (not officially
// supported by Google, could change) — confirm this actually works
// before building the rest of the pipeline around it.
export async function findVideo(_request) {
  throw new Error("not implemented: findVideo");
}

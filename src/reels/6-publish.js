// Step 6: publish the finished Reel to Instagram via Composio. Gated
// behind config.reelPublish (REEL_PUBLISH=1) so nothing posts until this
// pipeline is actually built and tested — same posture as the news
// carousel's CAROUSEL_PUBLISH gate in 7-publish.js.
// TODO: implement once step 4 produces a real clip file. Instagram's
// Reels media type is distinct from the carousel's image/video
// containers (src/clients/instagram.js) — confirm the exact
// INSTAGRAM_CREATE_MEDIA_CONTAINER parameters for media_type: "REELS"
// before assuming the existing carousel helpers can be reused as-is.
export async function publishReel(_input) {
  throw new Error("not implemented: publishReel");
}

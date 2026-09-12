// Step 8: cross-post the Reel's clip + caption to the Facebook Page,
// right after the same content goes to Instagram. Reuses the exact video
// already uploaded for the IG Reel (videoUrl from step 6) -- no second
// upload needed. Best-effort: this only ever runs after the IG post has
// already succeeded, and its own failure is logged but never fails the
// overall run -- the Reel's real job (posting to Instagram) is already
// done by the time this runs. Mirrors src/pipeline/9-crosspost-facebook.js
// for the carousel, with its own independent publish gate since this is a
// separate (video) code path that needs its own live validation.
import { config } from "../config.js";
import { createVideoPost } from "../clients/facebook.js";

export async function crosspostReelToFacebook({ videoUrl, message }) {
  if (!config.reelFacebookCrosspostPublish) {
    return { published: false, note: "REEL_FACEBOOK_CROSSPOST_PUBLISH is off — dry run, nothing posted." };
  }

  try {
    const result = await createVideoPost({ videoUrl, message });
    return { published: true, note: "Cross-posted to Facebook Page", postId: result?.post_id || result?.id || "" };
  } catch (err) {
    console.log("facebook reel crosspost:", err.message);
    return { published: false, note: `Facebook cross-post failed: ${err.message}` };
  }
}

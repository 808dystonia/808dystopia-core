// Step 9: cross-post the carousel's slides + caption to the Facebook
// Page as one multi-photo post, right after the same content goes to
// Instagram -- matches the IG carousel's multiple slides, instead of
// only ever cross-posting the cover. Reuses the images already uploaded
// for the IG carousel (slide1Url/slide2Url from step 7) -- no second
// upload needed. Best-effort: this only ever runs after the IG post has
// already succeeded, and its own failure is logged but never fails the
// overall run -- the carousel's real job (posting to Instagram) is
// already done by the time this runs.
import { config } from "../config.js";
import { createMultiPhotoPost } from "../clients/facebook.js";

export async function crosspostToFacebook({ imageUrls, message }) {
  if (!config.facebookCrosspostPublish) {
    return { published: false, note: "FACEBOOK_CROSSPOST_PUBLISH is off — dry run, nothing posted." };
  }

  try {
    const result = await createMultiPhotoPost({ imageUrls, message });
    return { published: true, note: "Cross-posted to Facebook Page", postId: result?.post_id || result?.id || "" };
  } catch (err) {
    console.log("facebook crosspost:", err.message);
    return { published: false, note: `Facebook cross-post failed: ${err.message}` };
  }
}

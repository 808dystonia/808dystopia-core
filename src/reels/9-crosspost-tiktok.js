// Step 9: cross-post the Reel's clip to TikTok, right after Instagram
// (and Facebook). Reuses the same local clip file step 4 produced
// (video.clipPath) rather than re-downloading or re-hosting anything --
// TikTok's FILE_UPLOAD flow needs the raw bytes, not a URL, and that file
// is still on disk at this point (see 4-process-clip.js's own doc
// comment on why it's never cleaned up mid-run). Best-effort, same
// posture as crosspostReelToFacebook: only runs after the IG post has
// already succeeded, and its own failure is logged but never fails the
// overall run.
import { config } from "../config.js";
import { postVideoToTikTok } from "../clients/tiktokPost.js";

export async function crosspostReelToTikTok({ clipPath, caption }) {
  if (!config.reelTikTokCrosspostPublish) {
    return { published: false, note: "REEL_TIKTOK_CROSSPOST_PUBLISH is off — dry run, nothing posted." };
  }

  try {
    const result = await postVideoToTikTok({ filePath: clipPath, caption });
    // privacyLevel matters here, not just cosmetically: until this app
    // passes TikTok's audit, creator_info only offers SELF_ONLY (see
    // clients/tiktokPost.js), so a "published: true" run can still be
    // completely invisible to anyone but the account owner.
    return {
      published: true,
      note: `Cross-posted to TikTok (${result.status}, privacy: ${result.privacyLevel})`,
      publishId: result.publishId,
      privacyLevel: result.privacyLevel,
    };
  } catch (err) {
    console.log("tiktok reel crosspost:", err.message);
    return { published: false, note: `TikTok cross-post failed: ${err.message}` };
  }
}

// Share a confirmed feed post to Instagram Stories. Runs as a follow-up
// after the IG receipt is saved, so a Story failure never affects the
// post itself, and it is never retried automatically.
import { config } from "../config.js";
import { postStory } from "../clients/instagram.js";

// Stories published through the API must be 3-60 seconds long.
const MAX_STORY_VIDEO_SECONDS = 60;

export async function shareToStory({ imageUrl, videoUrl, durationSeconds }) {
  if (!config.storySharePublish) {
    return { status: "disabled", note: "IG_STORY_SHARE_PUBLISH is off — nothing shared." };
  }
  if (videoUrl && durationSeconds > MAX_STORY_VIDEO_SECONDS) {
    return { status: "skipped", note: `Clip is ${Math.round(durationSeconds)}s; Stories allow ${MAX_STORY_VIDEO_SECONDS}s.` };
  }
  try {
    const id = await postStory({ imageUrl, videoUrl });
    return { status: "posted", id };
  } catch (err) {
    console.log("story share:", err.message);
    return { status: "failed", note: `Story share failed: ${err.message}` };
  }
}

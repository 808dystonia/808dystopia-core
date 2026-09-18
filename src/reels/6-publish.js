// Publish one Reel; comments and Facebook run only after its receipt is saved.
import { config } from "../config.js";
import { publishReelToRepo } from "../clients/githubMedia.js";
import { createReelContainer, waitForContainerReady, publishContainer } from "../clients/instagram.js";

import { publishOnce } from "../ops/publishing.js";

export async function publishReel({ clipPath, caption, identity, metadata }) {
  if (!config.reelPublish) {
    return { published: false, note: "REEL_PUBLISH is off — dry run, nothing posted." };
  }

  const videoUrl = await publishReelToRepo(clipPath, `reel-${Date.now()}.mp4`);

  const containerId = await createReelContainer(videoUrl, caption.caption);
  await waitForContainerReady(containerId);

  const confirmed = await publishOnce({
    pipeline: "reel", identity, metadata, platform: "instagram",
    publish: async () => ({ published: true, mediaId: await publishContainer(containerId) }),
  });
  const { mediaId } = confirmed;

  // videoUrl is returned alongside mediaId so a downstream cross-post
  // (Facebook) can reuse the exact same already-uploaded clip instead of
  // uploading it a second time.
  return { ...confirmed, videoUrl, note: `Published as IG media ${mediaId}` };
}

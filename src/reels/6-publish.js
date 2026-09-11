// Step 6: publish the finished Reel to Instagram via Composio. Gated
// behind config.reelPublish (REEL_PUBLISH=1) so nothing posts until this
// pipeline is actually built and tested — same posture as the news
// carousel's CAROUSEL_PUBLISH gate in pipeline/7-publish.js.
//
// Instagram Reels needs a publicly-fetchable video_url, same constraint as
// the carousel's images/closer video — so the clip gets committed to this
// repo and served via raw.githubusercontent.com (see
// clients/githubMedia.js) rather than any third-party host (ImgBB was
// rejected by Instagram's media fetcher for the carousel, for reasons
// that'd apply here too).
//
// Unlike the carousel (multiple containers combined into one carousel
// container), a Reel is a single standalone container — see
// clients/instagram.js's createReelContainer for the media_type: "REELS"
// shape, which is NOT yet live-validated (this session's local Composio
// key is stale — confirm on the first real test run).
import { config } from "../config.js";
import { publishReelToRepo } from "../clients/githubMedia.js";
import { createReelContainer, waitForContainerReady, publishContainer, postComment } from "../clients/instagram.js";

export async function publishReel({ clipPath, caption }) {
  if (!config.reelPublish) {
    return { published: false, note: "REEL_PUBLISH is off — dry run, nothing posted." };
  }

  const videoUrl = await publishReelToRepo(clipPath, `reel-${Date.now()}.mp4`);

  const containerId = await createReelContainer(videoUrl, caption.caption);
  await waitForContainerReady(containerId);

  const mediaId = await publishContainer(containerId);
  await postComment(mediaId, caption.hashtags);

  return { published: true, mediaId, note: `Published as IG media ${mediaId}` };
}

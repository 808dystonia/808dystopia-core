// Prepare media, claim content, then persist the confirmed IG ID before follow-ups.
import { config } from "../config.js";
import { publishImageToRepo, publishCarouselVideoToRepo } from "../clients/githubMedia.js";
import {
  createImageContainer,
  createVideoContainer,
  waitForContainerReady,
  createCarouselContainer,
  createCollabCarouselContainer,
  createReadyContainer,
  publishContainer,
} from "../clients/instagram.js";

// The closer video never changes per-post, so instead of re-uploading it
// on every run, it's served straight from the repo's own public GitHub
// URL, pinned to the commit that added it — stable regardless of which
// branch is currently checked out. Update this if closer.mp4 is ever
// replaced with a new file.
const CLOSER_VIDEO_URL =
  "https://raw.githubusercontent.com/808dystonia/808dystopia-core/b0f477120070c70426b4893967d1c3f2116c5dee/src/templates/assets/closer.mp4";

import { publishOnce } from "../ops/publishing.js";

export async function publishCarousel({ slides, caption, identity, metadata }) {
  if (!config.publish) {
    return { published: false, note: "CAROUSEL_PUBLISH is off — dry run, nothing posted." };
  }

  // Sequential, not just for reliability against Instagram's fetcher (see
  // below) but because two concurrent git commits against the same local
  // working directory would corrupt each other's state.
  const runId = Date.now();
  const slide1Url = await publishImageToRepo(slides.slide1Path, `slide1-${runId}.png`);
  const slide2Url = await publishImageToRepo(slides.slide2Path, `slide2-${runId}.png`);
  // Video-drop carousels carry a clip of the new video as slide 2:
  // cover, clip, info slide, closer.
  let clipUrl = null;
  if (slides.videoClipPath) {
    try {
      clipUrl = await publishCarouselVideoToRepo(slides.videoClipPath, `video-clip-${runId}.mp4`);
    } catch (err) {
      console.log("video clip upload failed, posting without it:", err.message);
    }
  }

  // Creating these concurrently (as this originally did) is unreliable —
  // confirmed by reproducing real, non-deterministic failures from
  // Instagram's media fetcher ("Timeout", "Media download has failed")
  // when multiple container-creation calls hit the same IG account at
  // once. Sequential creation adds a few seconds but is solid. Polling
  // status afterward doesn't trigger a new fetch, so that stays parallel.
  const slide1ContainerId = await createImageContainer(slide1Url);
  const slide2ContainerId = await createImageContainer(slide2Url);
  const closerContainerId = await createVideoContainer(CLOSER_VIDEO_URL);
  await Promise.all([slide1ContainerId, slide2ContainerId, closerContainerId].map((id) => waitForContainerReady(id)));

  // A clip Instagram rejects is dropped, not allowed to sink the post.
  let clipContainerId = null;
  if (clipUrl) {
    try {
      clipContainerId = await createVideoContainer(clipUrl);
      await waitForContainerReady(clipContainerId);
    } catch (err) {
      console.log("video clip slide failed, posting without it:", err.message);
      clipContainerId = null;
    }
  }

  const children = [slide1ContainerId, clipContainerId, slide2ContainerId, closerContainerId].filter(Boolean);

  const { containerId: carouselContainerId, collaborator } = await createReadyContainer({
    label: "carousel",
    collaborator: caption.collaborator,
    withCollaborator: (collaborators) => createCollabCarouselContainer({ children, caption: caption.caption, collaborators }),
    plain: () => createCarouselContainer({ children, caption: caption.caption }),
  });

  const confirmed = await publishOnce({
    pipeline: "carousel", identity, metadata, platform: "instagram",
    publish: async () => ({ published: true, mediaId: await publishContainer(carouselContainerId) }),
  });
  const { mediaId } = confirmed;

  // slide1Url/slide2Url are returned alongside mediaId so a downstream
  // cross-post (Facebook) can reuse the exact same already-uploaded
  // slides instead of uploading them a second time.
  const invite = collaborator ? `, collab invite sent to @${collaborator}` : "";
  const withClip = clipContainerId ? ", with video clip slide" : "";
  return { ...confirmed, slide1Url, slide2Url, note: `Published as IG media ${mediaId}${withClip}${invite}` };
}

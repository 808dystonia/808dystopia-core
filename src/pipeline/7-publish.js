// Step 7: publish the carousel (2 rendered image slides + the closer
// video) via Composio's Instagram tools, then post the hashtag block as a
// separate first comment. Gated behind config.publish (CAROUSEL_PUBLISH=1)
// so nothing posts until the pipeline is actually built and tested — with
// the flag off, this makes no external calls at all.
import { config } from "../config.js";
import { uploadImage } from "../clients/imgbb.js";
import {
  createImageContainer,
  createVideoContainer,
  waitForContainerReady,
  createCarouselContainer,
  publishContainer,
  postComment,
} from "../clients/instagram.js";

// The closer video never changes per-post, so instead of re-uploading it
// on every run, it's served straight from the repo's own public GitHub
// URL, pinned to the commit that added it — stable regardless of which
// branch is currently checked out. Update this if closer.mp4 is ever
// replaced with a new file.
const CLOSER_VIDEO_URL =
  "https://raw.githubusercontent.com/808dystonia/808dystopia-core/b0f477120070c70426b4893967d1c3f2116c5dee/src/templates/assets/closer.mp4";

export async function publishCarousel({ slides, caption }) {
  if (!config.publish) {
    return { published: false, note: "CAROUSEL_PUBLISH is off — dry run, nothing posted." };
  }

  const [slide1Url, slide2Url] = await Promise.all([
    uploadImage(slides.slide1Path),
    uploadImage(slides.slide2Path),
  ]);

  const [slide1ContainerId, slide2ContainerId, closerContainerId] = await Promise.all([
    createImageContainer(slide1Url),
    createImageContainer(slide2Url),
    createVideoContainer(CLOSER_VIDEO_URL),
  ]);
  await Promise.all([
    waitForContainerReady(slide1ContainerId),
    waitForContainerReady(slide2ContainerId),
    waitForContainerReady(closerContainerId),
  ]);

  const carouselContainerId = await createCarouselContainer({
    children: [slide1ContainerId, slide2ContainerId, closerContainerId],
    caption: caption.caption,
  });
  await waitForContainerReady(carouselContainerId);

  const mediaId = await publishContainer(carouselContainerId);
  await postComment(mediaId, caption.hashtags);

  return { published: true, mediaId, note: `Published as IG media ${mediaId}` };
}

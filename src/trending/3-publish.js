// Step 3: publish the rendered chart as a single IG image post. Gated
// behind config.trendingTuesdayPublish -- nothing posts until tested,
// same posture as every other pipeline here.
import { config } from "../config.js";
import { publishImageToRepo } from "../clients/githubMedia.js";
import { createStandaloneImageContainer, waitForContainerReady, publishContainer } from "../clients/instagram.js";

function buildCaption(rankings) {
  const lines = rankings.map((entry, i) => `${i + 1}. ${entry.name} — ${entry.streamsLabel}`).join("\n");
  return `808 TRENDING TUESDAY\nTop 10 underground rappers moving right now.\n\n${lines}\n\nFollow @808dystopia · more on 808dystopia.win`;
}

export async function publishChart({ chartPath, rankings }) {
  const caption = buildCaption(rankings);

  if (!config.trendingTuesdayPublish) {
    return { published: false, note: "TRENDING_TUESDAY_PUBLISH is off — dry run, nothing posted.", caption };
  }

  const imageUrl = await publishImageToRepo(chartPath, `trending-${Date.now()}.png`);
  const containerId = await createStandaloneImageContainer(imageUrl, caption);
  await waitForContainerReady(containerId);
  const mediaId = await publishContainer(containerId);

  return { published: true, mediaId, note: `Published as IG media ${mediaId}` };
}

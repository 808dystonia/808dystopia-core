// Step 3: post the digest to #underground-news as an embed with a "• "
// bulleted description — the exact shape the carousel pipeline's own
// splitIntoStories() already parses from the morning Grok digest
// (message.embeds[0].description, split on newlines, bullet markers
// stripped), so these 12 PM/6 PM digests also become usable story
// candidates for the carousel's own posting runs, not just human-visible
// Discord messages.
import { config } from "../config.js";
import { postMessage } from "../clients/discord.js";

export async function postDigest(stories) {
  if (stories.length === 0) {
    return { published: false, note: "No notable underground rap news found this cycle." };
  }

  const description = stories.map((s) => `• ${s}`).join("\n");

  if (!config.newsBriefPublish) {
    return { published: false, note: "NEWS_BRIEF_PUBLISH is off — dry run, nothing posted.", description };
  }

  await postMessage(config.discord.heatChannelId, { embeds: [{ description }] });
  return { published: true, note: `Posted ${stories.length} stories to #underground-news` };
}

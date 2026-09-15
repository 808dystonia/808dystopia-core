// Step 2: pin Grok's generated mashup to the RapToonz board, disclosing
// it's AI-generated fan art (both good practice and Pinterest's own
// policy on manipulated/synthetic media), then log the source Discord
// message so the same generation never gets pinned twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { appendRaptoonzLogRow } from "../clients/googleSheets.js";

export async function postPin(candidate) {
  if (!candidate) {
    return { published: false, note: "No new RapToonz image posted in #raptoonz to pin right now." };
  }

  const { rapper, style, messageId, imageUrl } = candidate;
  const description =
    `AI-generated fan art: ${rapper} reimagined in the art style of "${style}." ` +
    `Not affiliated with or endorsed by ${rapper}, "${style}," or their respective creators/owners. #RapToonz`;

  if (!config.raptoonzPublish) {
    return {
      published: false,
      note: "RAPTOONZ_PUBLISH is off — dry run, nothing pinned.",
      rapper,
      style,
      description,
    };
  }

  const result = await createPin({
    boardId: config.pinterest.raptoonzBoardId,
    title: `${rapper} x ${style} — RapToonz`,
    description,
    imageUrl,
  });
  const pinId = result?.id || "";

  await appendRaptoonzLogRow({
    timestamp: new Date().toISOString(),
    rapper,
    style,
    messageId,
    pinId,
    status: "posted",
  });

  return { published: true, note: `Pinned ${rapper} x ${style}`, pinId };
}

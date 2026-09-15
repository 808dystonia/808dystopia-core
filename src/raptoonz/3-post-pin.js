// Step 3: pin the generated mashup to the RapToonz board, disclosing
// it's AI-generated fan art (both good practice and Pinterest's own
// policy on manipulated/synthetic media), then log it so the same
// rapper x style pair never gets generated twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { appendRaptoonzLogRow } from "../clients/googleSheets.js";

export async function postPin(candidate, generated) {
  if (!candidate) {
    return { published: false, note: "No unclaimed rapper x cartoon-style pair left to generate right now." };
  }

  const { rapper, style } = candidate;
  const description =
    `AI-generated fan art: ${rapper} reimagined in the art style of "${style.name}." ` +
    `Not affiliated with or endorsed by ${rapper}, "${style.name}," or their respective creators/owners. #RapToonz`;

  if (!config.raptoonzPublish) {
    return {
      published: false,
      note: "RAPTOONZ_PUBLISH is off — dry run, nothing pinned.",
      rapper,
      style: style.name,
      description,
    };
  }

  const result = await createPin({
    boardId: config.pinterest.raptoonzBoardId,
    title: `${rapper} x ${style.name} — RapToonz`,
    description,
    imageUrl: generated.imageUrl,
  });
  const pinId = result?.id || "";

  await appendRaptoonzLogRow({
    timestamp: new Date().toISOString(),
    rapper,
    style: style.name,
    pinId,
    status: "posted",
  });

  return { published: true, note: `Pinned ${rapper} x ${style.name}`, pinId };
}

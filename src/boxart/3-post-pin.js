// Step 3: host the rendered cover (same repo-commit hosting the other
// pipelines use -- see clients/githubMedia.js for why), pin it to the
// "808 Box Art" board, then log the source Discord message so the same
// photo drop never gets turned into a cover twice.
import { config } from "../config.js";
import { publishBoxArtToRepo } from "../clients/githubMedia.js";
import { createPin } from "../clients/pinterest.js";
import { appendBoxArtLogRow } from "../clients/googleSheets.js";

export async function postPin(candidate, rendered) {
  if (!candidate) {
    return { published: false, note: "No new photo posted in #boxart to turn into a cover right now." };
  }

  const { artist, messageId } = candidate;
  const description =
    `Fan art: ${artist} reimagined as a PS1/PS2-era game case cover. ` +
    `Not affiliated with or endorsed by ${artist}, Sony, or PlayStation. #BoxArt`;

  if (!config.boxartPublish) {
    return {
      published: false,
      note: "BOXART_PUBLISH is off — dry run, nothing pinned.",
      artist,
      description,
      renderedCoverPath: rendered.coverPath,
    };
  }

  const imageUrl = await publishBoxArtToRepo(rendered.coverPath, `boxart-${Date.now()}.png`);

  const result = await createPin({
    boardId: config.pinterest.boxartBoardId,
    title: `${artist} — Box Art`,
    description,
    imageUrl,
  });
  const pinId = result?.id || "";

  await appendBoxArtLogRow({
    timestamp: new Date().toISOString(),
    artist,
    messageId,
    pinId,
    status: "posted",
  });

  return { published: true, note: `Pinned ${artist}'s box art cover`, pinId };
}

// Step 2: pin the candidate's album cover art to the "Underground Hiphop
// album cover art" board, crediting the artist in the description, then
// log it so the same album never gets pinned twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { appendPinLogRow } from "../clients/googleSheets.js";

import { publishOnce, bestEffort, recordFollowups } from "../ops/publishing.js";

export async function postPin(candidate) {
  if (!candidate) {
    return { published: false, note: "No unclaimed underground release found to pin right now." };
  }

  const { artist, album } = candidate;
  const description = `Album cover art for "${album.name}" by ${artist}${
    album.releaseDate ? `, released ${album.releaseDate}` : ""
  }. Underground hip-hop. Credit: ${artist}.`;

  if (!config.pinPublish) {
    return {
      published: false,
      note: "PIN_PUBLISH is off — dry run, nothing pinned.",
      artist,
      album: album.name,
      description,
    };
  }

  const result = await publishOnce({
    pipeline: 'pin', identity: `${artist}|${album.name}`, platform: 'pinterest',
    metadata: { artist, title: album.name, topic: 'album', format: 'pin' },
    publish: async () => {
      const pin = await createPin({ boardId: config.pinterest.boardId, title: `${album.name} — ${artist}`, description, imageUrl: album.imageUrl, link: album.spotifyUrl });
      return { published: true, pinId: pin?.id };
    },
  });
  const logged = await bestEffort(() => appendPinLogRow({ timestamp: new Date().toISOString(), artist, album: album.name, pinId: result.pinId, status: 'posted' }));
  const outcomes = { pinterest: { status: 'posted', id: result.pinId }, sheets: { status: logged.ok ? 'recorded' : 'failed' } };
  const saved = await bestEffort(() => recordFollowups('pin', result.key, outcomes));
  return { ...result, outcomes, followupFailed: !logged.ok || !saved.ok, note: `Pinned "${album.name}" by ${artist}` };
}

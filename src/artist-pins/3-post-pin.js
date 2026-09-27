// Step 3: pin the photo to His Underground or Her Underground, crediting
// where the photo came from and linking to the artist's Spotify when
// there is one. The pre-publish claim (identity = board + artist + image)
// is what stops the same photo ever being pinned twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { publishOnce } from "../ops/publishing.js";

export const BOARDS = {
  male: { pipeline: "his-pin", label: "His Underground", boardId: () => config.pinterest.hisBoardId },
  female: { pipeline: "her-pin", label: "Her Underground", boardId: () => config.pinterest.herBoardId },
};

export function buildPinText({ name, role }, photo, gender) {
  const board = BOARDS[gender].label;
  const credit = photo.credit ? ` Photo: ${photo.credit}.` : "";
  return {
    title: `${name} — ${board}`,
    description: `${name}, underground ${role === "producer" ? "producer" : "rapper"} on the 808 Dystopia radar.${credit} Follow @808dystopia on IG.`,
    link: photo.spotifyUrl || photo.sourceUrl || null,
  };
}

export async function postArtistPin(gender, candidate, photo, publish = createPin) {
  const board = BOARDS[gender];
  if (!candidate || !photo) {
    return { published: false, note: `No eligible artist with a usable photo for ${board.label} right now.` };
  }
  const text = buildPinText(candidate, photo, gender);

  if (!config.artistPinPublish) {
    return { published: false, note: "ARTIST_PIN_PUBLISH is off — dry run, nothing pinned.", artist: candidate.name, photoSource: photo.source, imageUrl: photo.imageUrl, ...text };
  }

  const result = await publishOnce({
    pipeline: board.pipeline,
    identity: `${gender}|${candidate.name.toLowerCase()}|${photo.imageUrl}`,
    platform: "pinterest",
    metadata: { artist: candidate.name, title: candidate.name, topic: "artist", format: "pin", imageUrl: photo.imageUrl, photoSource: photo.source },
    publish: async () => {
      const pin = await publish({ boardId: board.boardId(), title: text.title, description: text.description, imageUrl: photo.imageUrl, link: text.link });
      return { published: true, pinId: pin?.id };
    },
  });
  return { ...result, note: `Pinned ${candidate.name} to ${board.label} (${photo.source} photo)` };
}

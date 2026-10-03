// Step 3: pin the photo to His Underground or Her Underground, crediting
// where the photo came from and linking to the artist's Spotify when
// there is one. The pre-publish claim (identity = board + artist + image)
// is what stops the same photo ever being pinned twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { publishOnce } from "../ops/publishing.js";
import { brandedImageOrUrl } from "../pins/render-pin.js";

export const BOARDS = {
  male: { pipeline: "his-pin", label: "His Underground", boardId: () => config.pinterest.hisBoardId },
  female: { pipeline: "her-pin", label: "Her Underground", boardId: () => config.pinterest.herBoardId },
};

// Keyword-rich, written as sentences: Pinterest ranks pins on the phrases
// people search ("underground rappers", "new rappers to know").
export function buildPinText({ name, role }, photo, gender) {
  const board = BOARDS[gender].label;
  const kind = role === "producer" ? "producer" : "rapper";
  const scene = gender === "female" ? "female rappers and producers" : "underground rappers and producers";
  const credit = photo.credit ? ` Photo: ${photo.credit}.` : "";
  return {
    title: `${name} — Underground ${kind === "producer" ? "Producer" : "Rapper"} | ${board}`,
    description:
      `${name}, an underground ${kind} on the 808 Dystopia radar. New ${scene} to know, ` +
      `underground hip-hop and rap aesthetic photos.${credit} Follow @808dystopia on Instagram for underground rap news.`,
    altText: `Photo of ${name}, underground ${kind}`,
    link: photo.spotifyUrl || photo.sourceUrl || null,
  };
}

export async function postArtistPin(gender, candidate, photo, publish = createPin, render) {
  const board = BOARDS[gender];
  if (!candidate || !photo) {
    return { published: false, note: `No eligible artist with a usable photo for ${board.label} right now.` };
  }
  const text = buildPinText(candidate, photo, gender);

  if (!config.artistPinPublish) {
    return { published: false, note: "ARTIST_PIN_PUBLISH is off — dry run, nothing pinned.", artist: candidate.name, photoSource: photo.source, imageUrl: photo.imageUrl, ...text };
  }

  // Rendered before the publish claim; a render failure pins the raw photo.
  const image = await brandedImageOrUrl(
    { imageUrl: photo.imageUrl, kicker: board.label.toUpperCase(), title: candidate.name, subtitle: `UNDERGROUND ${candidate.role === "producer" ? "PRODUCER" : "RAPPER"}` },
    render
  );
  const result = await publishOnce({
    pipeline: board.pipeline,
    identity: `${gender}|${candidate.name.toLowerCase()}|${photo.imageUrl}`,
    platform: "pinterest",
    metadata: { artist: candidate.name, title: candidate.name, topic: "artist", format: "pin", imageUrl: photo.imageUrl, photoSource: photo.source },
    publish: async () => {
      const pin = await publish({ boardId: board.boardId(), title: text.title, description: text.description, altText: text.altText, ...image, link: text.link });
      return { published: true, pinId: pin?.id };
    },
  });
  return { ...result, note: `Pinned ${candidate.name} to ${board.label} (${photo.source} photo${image.branded ? ", branded" : ""})` };
}

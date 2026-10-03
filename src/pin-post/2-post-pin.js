// Step 2: pin the candidate's album cover art to the "Underground Hiphop
// album cover art" board, crediting the artist in the description, then
// log it so the same album never gets pinned twice.
import { config } from "../config.js";
import { createPin } from "../clients/pinterest.js";
import { appendPinLogRow } from "../clients/googleSheets.js";

import { publishOnce, bestEffort, recordFollowups } from "../ops/publishing.js";
import { brandedImageOrUrl } from "../pins/render-pin.js";

// Pinterest is a search engine: the title and description carry the
// phrases people actually search for, written as sentences rather than
// hashtags.
export function buildAlbumPinText(artist, album) {
  const year = (album.releaseDate || "").slice(0, 4);
  return {
    title: `${album.name} by ${artist} — Album Cover Art`,
    description:
      `"${album.name}" by ${artist}${year ? ` (${year})` : ""}. Album cover art from the underground hip-hop scene: ` +
      `underground rap, new rap music and rap album covers worth saving. Listen on Spotify. ` +
      `Follow @808dystopia on Instagram for underground rap news.`,
    altText: `Album cover for "${album.name}" by ${artist}`,
  };
}

export async function postPin(candidate) {
  if (!candidate) {
    return { published: false, note: "No unclaimed underground release found to pin right now." };
  }

  const { artist, album } = candidate;
  const text = buildAlbumPinText(artist, album);
  const { description } = text;

  if (!config.pinPublish) {
    return {
      published: false,
      note: "PIN_PUBLISH is off — dry run, nothing pinned.",
      artist,
      album: album.name,
      description,
    };
  }

  // Rendered before the publish claim, so a render failure just means the
  // plain album art is pinned instead.
  const image = await brandedImageOrUrl({ imageUrl: album.imageUrl, kicker: "ALBUM COVER", title: album.name, subtitle: `BY ${artist}` });
  const result = await publishOnce({
    pipeline: 'pin', identity: `${artist}|${album.name}`, platform: 'pinterest',
    metadata: { artist, title: album.name, topic: 'album', format: 'pin' },
    publish: async () => {
      const pin = await createPin({ boardId: config.pinterest.boardId, ...text, ...image, link: album.spotifyUrl });
      return { published: true, pinId: pin?.id };
    },
  });
  const logged = await bestEffort(() => appendPinLogRow({ timestamp: new Date().toISOString(), artist, album: album.name, pinId: result.pinId, status: 'posted' }));
  const outcomes = { pinterest: { status: 'posted', id: result.pinId }, sheets: { status: logged.ok ? 'recorded' : 'failed' } };
  const saved = await bestEffort(() => recordFollowups('pin', result.key, outcomes));
  return { ...result, outcomes, followupFailed: !logged.ok || !saved.ok, note: `Pinned "${album.name}" by ${artist}${image.branded ? "" : " (plain image, branded render failed)"}` };
}

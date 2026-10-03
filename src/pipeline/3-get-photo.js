// Step 3: a real, sharp photo of the artist/producer. Never AI-generated.
//
// Sources, in order: the Genius profile photo, the artist's Spotify photo
// (exact-name match only), the wide Genius header banner, then Pinterest's
// own pinned content. Genius placeholders never count (isPlaceholderAvatar).
//
// A photo is only used if it's sharp enough for the cover: it may be
// upscaled at most MAX_UPSCALE to fill the visible photo box (1080x840 --
// below that the cover is solid black). Taking the first photo found put a
// 265x265 Genius image, stretched 4x, on EsDeeKid's 9/21 cover. If no
// source is sharp enough, index.js treats this story as failed and moves on
// to the next one rather than posting a blurry cover.
import { getArtistImages } from "../clients/genius.js";
import { searchOwnPins } from "../clients/pinterest.js";
import { getArtistProfile } from "../clients/spotify.js";
import { imageSize } from "../util/imageSize.js";

const PHOTO_BOX = { width: 1080, height: 840 };
export const MAX_UPSCALE = 2;

export function upscaleNeeded({ width, height }) {
  if (!width || !height) return Infinity;
  return Math.max(PHOTO_BOX.width / width, PHOTO_BOX.height / height);
}

// Genius encodes the stored size in the URL (".265x265x1.jpg"); anything
// else is measured from the file itself.
async function measure(candidate, fetchImpl) {
  if (candidate.width && candidate.height) return candidate;
  const fromUrl = /\.(\d+)x(\d+)x\d+\.\w+(?:\?|$)/.exec(candidate.url);
  if (fromUrl) return { ...candidate, width: Number(fromUrl[1]), height: Number(fromUrl[2]) };
  const res = await fetchImpl(candidate.url);
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const size = imageSize(Buffer.from(await res.arrayBuffer()));
  return { ...candidate, ...(size || {}) };
}

async function attempt(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.log(`${label}:`, err.message);
    return null;
  }
}

export async function getPhoto(artist, { fetchImpl = fetch } = {}) {
  let genius = null;
  const sources = [
    async () => {
      genius = await attempt("genius", () => getArtistImages(artist));
      return genius?.image ? { url: genius.image, source: "genius" } : null;
    },
    async () => {
      const profile = await attempt("spotify", () => getArtistProfile(artist));
      return profile?.imageUrl ? { url: profile.imageUrl, width: profile.width, height: profile.height, source: "spotify" } : null;
    },
    async () => (genius?.header ? { url: genius.header, source: "genius-header" } : null),
    async () => {
      const url = await attempt("pinterest", () => searchOwnPins(artist));
      return url ? { url, source: "pinterest" } : null;
    },
  ];

  for (const next of sources) {
    const candidate = await next();
    if (!candidate) continue;
    const measured = await attempt(`measure ${candidate.source}`, () => measure(candidate, fetchImpl));
    const factor = measured ? upscaleNeeded(measured) : Infinity;
    if (factor <= MAX_UPSCALE) return { ok: true, url: candidate.url, source: candidate.source };
    console.log(`photo: ${candidate.source} ${measured?.width ?? "?"}x${measured?.height ?? "?"} too small for the cover`);
  }
  return { ok: false };
}

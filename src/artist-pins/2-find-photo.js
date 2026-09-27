// Step 2: a real photo of the artist, best source first:
//   1. the secret "Underground Photo Drop" board -- photos saved there by
//      hand, matched on the artist's name in the pin's title/description
//   2. Google Images (Composio's image search), only when the result's own
//      page title or URL names the artist -- the main risk with web image
//      search is a same-named stranger, so an unconfirmed hit is skipped
//   3. the artist's Spotify profile photo (exact-name match)
//   4. the artist's Genius photo (exact-name match, placeholders skipped)
// Never AI-generated. A photo already pinned on this board is never
// reused, and anything too small to look solid on Pinterest is skipped.
import { config } from "../config.js";
import { listBoardPins } from "../clients/pinterest.js";
import { searchImages } from "../clients/imageSearch.js";
import { getArtistProfile } from "../clients/spotify.js";
import { getArtistPhoto } from "../clients/genius.js";

export const MIN_SIDE = 600;

// Short-lived signed CDN URLs (Instagram/Facebook/TikTok) often expire or
// refuse hotlinking before Pinterest fetches them.
const UNSTABLE_HOST = /(fbcdn|cdninstagram|lookaside|tiktokcdn|fbsbx)\./i;

const compact = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// True when 1-3 consecutive words of `text` spell the artist's name --
// "Pixy" matches "PIXY live in London" or ".../pixy-press-shot" but not
// "pixyland" or "pix y".
export function mentionsArtist(name, text, minLength = 3) {
  const target = compact(name);
  if (target.length < minLength || !text) return false;
  const words = String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(i + 3, words.length); j++) {
      joined += words[j];
      if (joined === target) return true;
    }
  }
  return false;
}

const bigEnough = (width, height) => !width || !height || Math.min(width, height) >= MIN_SIDE;

export function pickDropPhoto(name, pins, used) {
  return pins.find((pin) => pin.imageUrl && !used.has(pin.imageUrl) && mentionsArtist(name, pin.text) && bigEnough(pin.width, pin.height)) || null;
}

// Web results must name the artist on their own page, have known
// dimensions, and be large enough; portrait shots first, since Pinterest
// favours tall pins.
export function pickWebPhoto(name, results, used) {
  const usable = results.filter(
    (r) =>
      r.imageUrl &&
      !used.has(r.imageUrl) &&
      !UNSTABLE_HOST.test(r.imageUrl) &&
      !/\.(gif|svg)(\?|$)/i.test(r.imageUrl) &&
      r.width && r.height && Math.min(r.width, r.height) >= MIN_SIDE &&
      (mentionsArtist(name, r.title, 4) || mentionsArtist(name, r.pageUrl, 4))
  );
  return usable.find((r) => r.height >= r.width) || usable[0] || null;
}

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
};

async function attempt(label, fn) {
  try { return await fn(); }
  catch (err) { console.log(`${label}:`, err.message); return null; }
}

// Read once per run, not once per artist tried.
export async function loadDropPins(list = listBoardPins) {
  if (!config.pinterest.photoDropBoardId) return [];
  return (await attempt("photo drop", () => list(config.pinterest.photoDropBoardId))) || [];
}

export async function findPhoto({ name, role }, used, dropPins, deps = { searchImages, getArtistProfile, getArtistPhoto }) {
  const profile = await attempt("spotify", () => deps.getArtistProfile(name));
  const spotifyUrl = profile?.spotifyUrl || null;

  const drop = pickDropPhoto(name, dropPins, used);
  if (drop) return { imageUrl: drop.imageUrl, source: "photo-drop", credit: hostOf(drop.link), sourceUrl: drop.link, spotifyUrl };

  const webResults = (await attempt("image search", () => deps.searchImages(`"${name}" ${role === "producer" ? "producer" : "rapper"}`))) || [];
  const web = pickWebPhoto(name, webResults, used);
  if (web) return { imageUrl: web.imageUrl, source: "web", credit: hostOf(web.pageUrl), sourceUrl: web.pageUrl, spotifyUrl };

  if (profile?.imageUrl && !used.has(profile.imageUrl) && bigEnough(profile.width, profile.height)) {
    return { imageUrl: profile.imageUrl, source: "spotify", credit: "Spotify", sourceUrl: spotifyUrl, spotifyUrl };
  }

  const genius = await attempt("genius", () => deps.getArtistPhoto(name));
  if (genius && !used.has(genius)) return { imageUrl: genius, source: "genius", credit: "Genius", sourceUrl: null, spotifyUrl };

  return null;
}

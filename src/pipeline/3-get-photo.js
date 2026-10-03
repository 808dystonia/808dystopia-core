// Step 3: real photo of the artist/producer. Genius artist photo first
// (fully automated, covers underground/regional hip-hop well), then the
// artist's Spotify profile photo (exact-name match only), then Pinterest's
// own pinned content (via Composio). Genius placeholders never count as a
// photo (see isPlaceholderAvatar). Never AI-generated.
// Google Custom Search was dropped as a fallback entirely — Google
// discontinued free "search the entire web" for new Programmable Search
// Engines (March 2026). If both miss, index.js treats this candidate as
// failed and moves on to the next-newest unused one.
import { getArtistPhoto } from "../clients/genius.js";
import { searchOwnPins } from "../clients/pinterest.js";
import { getArtistProfile } from "../clients/spotify.js";

export async function getPhoto(artist) {
  try {
    const geniusUrl = await getArtistPhoto(artist);
    if (geniusUrl) return { ok: true, url: geniusUrl, source: "genius" };
  } catch (err) {
    console.log("genius:", err.message);
  }

  try {
    const profile = await getArtistProfile(artist);
    if (profile?.imageUrl) return { ok: true, url: profile.imageUrl, source: "spotify" };
  } catch (err) {
    console.log("spotify:", err.message);
  }

  try {
    const pinUrl = await searchOwnPins(artist);
    if (pinUrl) return { ok: true, url: pinUrl, source: "pinterest" };
  } catch (err) {
    console.log("pinterest:", err.message);
  }

  return { ok: false };
}

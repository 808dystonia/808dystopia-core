// Step 3: real photo of the artist/producer. Pinterest (own pinned content,
// via Composio) first, Google Custom Search image fallback second. Never
// AI-generated. If both fail, index.js treats this candidate as failed and
// moves on to the next-newest unused one.
import { searchOwnPins } from "../clients/pinterest.js";
import { imageSearch } from "../clients/googleSearch.js";

export async function getPhoto(artist) {
  try {
    const pinUrl = await searchOwnPins(artist);
    if (pinUrl) return { ok: true, url: pinUrl, source: "pinterest" };
  } catch (err) {
    console.log("pinterest:", err.message);
  }

  try {
    const [googleUrl] = await imageSearch(`${artist} rapper`);
    if (googleUrl) return { ok: true, url: googleUrl, source: "google" };
  } catch (err) {
    console.log("google image search:", err.message);
  }

  return { ok: false };
}

// Step 3: real photo of the artist/producer, from the Pinterest account's
// own pinned content (via Composio). Never AI-generated. Google Custom
// Search was dropped as a fallback — Google discontinued free "search the
// entire web" for new Programmable Search Engines (March 2026), so it can
// no longer act as a general open-web fallback. If Pinterest has nothing,
// index.js treats this candidate as failed and moves on to the
// next-newest unused one.
import { searchOwnPins } from "../clients/pinterest.js";

export async function getPhoto(artist) {
  try {
    const pinUrl = await searchOwnPins(artist);
    if (pinUrl) return { ok: true, url: pinUrl, source: "pinterest" };
  } catch (err) {
    console.log("pinterest:", err.message);
  }

  return { ok: false };
}

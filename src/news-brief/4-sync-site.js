// Step 4: mirror this digest onto 808dystopia.win's Midday/Night news box
// (the Morning box is synced separately by src/morning-sync — see there
// for why that's a different pipeline). Best-effort: a site-sync failure
// should never fail the run that already successfully posted to Discord.
import { writeNewsSlot } from "../clients/netlifyBlobs.js";

export async function syncSite(slot, stories) {
  if (stories.length === 0) return { synced: false, note: "No stories to sync." };
  try {
    return await writeNewsSlot(slot, stories);
  } catch (err) {
    console.log("site sync:", err.message);
    return { synced: false, note: `Site sync failed: ${err.message}` };
  }
}

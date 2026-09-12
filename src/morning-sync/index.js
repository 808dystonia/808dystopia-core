// Mirrors Grok's morning #underground-news drop onto 808dystopia.win's
// Morning news box. Invoked by src/morning-sync-cron.js, gated to 10 AM
// Chicago time — by then Grok's own scheduled task should already have
// posted; if it hasn't, this just reports that rather than guessing.
import "dotenv/config";
import { getMorningStories } from "./1-get-morning-stories.js";
import { writeNewsSlot } from "../clients/netlifyBlobs.js";

export async function runMorningSync() {
  const stories = await getMorningStories();
  if (stories.length === 0) {
    return { synced: false, note: "No morning drop found in #underground-news yet today." };
  }
  return writeNewsSlot("morning", stories);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runMorningSync()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

// Cron entry point for the Reel pipeline (the GitHub Actions workflow
// invokes this via `npm run reel`, not reels/index.js directly). Same
// DST-safe approach as the news carousel's cron.js — see that file's
// comment for the reasoning — just gated to the 7 PM Chicago hour
// instead of 9 AM.
import { runDailyReelFlow } from "./reels/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && hour !== 19) {
  console.log(`Not the 7 PM Chicago hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runDailyReelFlow()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

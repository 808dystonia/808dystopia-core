// Cron entry point for the Reel pipeline (the GitHub Actions workflow
// invokes this via `npm run reel`, not reels/index.js directly). Same
// DST-safe approach as the news carousel's cron.js — see that file's
// comment for the reasoning — just gated to two target hours instead of
// one, same pattern as the carousel's own POST_HOURS list.
import { runDailyReelFlow } from "./reels/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [15, 19];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
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

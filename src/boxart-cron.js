// Cron entry point for the BoxArt pin (the GitHub Actions workflow invokes
// this via `npm run boxart`). Same DST-safe hourly-gate approach as the
// other pipelines -- see cron.js's comment for the reasoning. Matches the
// combined posting times of the other two Pinterest boards -- 9 AM/1 PM/
// 5 PM (album-art) plus 10 AM/2 PM/6 PM (RapToonz) -- rather than its own
// staggered slot, so BoxArt fires 6x/day alongside whichever of the other
// two boards is posting that hour.
import { runBoxArt } from "./boxart/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [9, 10, 13, 14, 17, 18];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runBoxArt()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// Cron entry point for the 11 AM/3 PM/7 PM BoxArt pin (the GitHub Actions
// workflow invokes this via `npm run boxart`). Same DST-safe hourly-gate
// approach as the other pipelines -- see cron.js's comment for the
// reasoning -- staggered from the album-art board (9/1/5) and RapToonz
// (10/2/6) so all three Pinterest pipelines don't fire in the same hour.
import { runBoxArt } from "./boxart/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [11, 15, 19];

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

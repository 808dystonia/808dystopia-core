// Cron entry point for the 10 AM/2 PM/6 PM Pinterest RapToonz pin (the
// GitHub Actions workflow invokes this via `npm run raptoonz`). Same
// DST-safe hourly-gate approach as the other pipelines -- see cron.js's
// comment for the reasoning -- offset an hour from the album-art Pin
// pipeline's 9/1/5 slots so the two Pinterest pipelines don't both fire
// in the same minute.
import { runRaptoonz } from "./raptoonz/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [10, 14, 18];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runRaptoonz()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

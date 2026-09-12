// Cron entry point for the Tuesday 5 PM CT trending chart (the GitHub
// Actions workflow invokes this via `npm run trending-tuesday`). Same
// DST-safe hourly-gate approach as the other pipelines — see cron.js's
// comment for the reasoning — plus a day-of-week check, since this only
// runs once a week rather than once (or a few times) a day.
import { runTrendingTuesday } from "./trending/index.js";
import { currentChicagoHour, currentChicagoWeekday } from "./util/chicagoHour.js";

const TARGET_HOUR = 17;
const TARGET_WEEKDAY = "Tuesday";

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
const weekday = currentChicagoWeekday();
if (isScheduledRun && (weekday !== TARGET_WEEKDAY || hour !== TARGET_HOUR)) {
  console.log(`Not the scheduled trending-chart slot (currently ${weekday} ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runTrendingTuesday()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

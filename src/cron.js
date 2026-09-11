// Cron entry point (the GitHub Actions workflow invokes this via
// `npm start`, not pipeline/index.js directly). GitHub Actions' cron
// schedule is a fixed UTC time with no timezone/DST concept, but the
// posting target is 9 AM America/Chicago year-round — 9 AM CDT and 9 AM
// CST are different UTC times. Rather than try to compute that offset
// ourselves (and get it wrong on the two DST-transition days), the
// workflow fires hourly and this only lets the real run through during
// the Chicago-local 9 AM hour: Intl's timezone conversion already uses
// the IANA tz database, which tracks DST transitions correctly without
// any manual date math.
//
// A human clicking "Run workflow" (workflow_dispatch) means "run it now"
// — GitHub sets GITHUB_EVENT_NAME to distinguish this from the scheduled
// trigger, so only the actual schedule is gated; a manual run and a
// direct `node src/pipeline/index.js` both always run immediately.
import { runDailyFlow } from "./pipeline/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && hour !== 9) {
  console.log(`Not the 9 AM Chicago hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runDailyFlow()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

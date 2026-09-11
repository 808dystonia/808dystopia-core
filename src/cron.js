// Cron entry point (the GitHub Actions workflow invokes this via
// `npm start`, not pipeline/index.js directly). GitHub Actions' cron
// schedule is a fixed UTC time with no timezone/DST concept, but the
// posting targets are 9 AM and 12 PM America/Chicago year-round — those
// local times land on different UTC times depending on whether it's CDT
// or CST. Rather than try to compute that offset ourselves (and get it
// wrong on the two DST-transition days), the workflow fires hourly and
// this only lets the real run through during one of the target Chicago
// hours: Intl's timezone conversion already uses the IANA tz database,
// which tracks DST transitions correctly without any manual date math.
//
// A human clicking "Run workflow" (workflow_dispatch) means "run it now"
// — GitHub sets GITHUB_EVENT_NAME to distinguish this from the scheduled
// trigger, so only the actual schedule is gated; a manual run and a
// direct `node src/pipeline/index.js` both always run immediately.
//
// The 12 PM run isn't a special case: it just walks candidates the same
// way as 9 AM, and the existing Sheet-log dedup (isAlreadyPosted) already
// stops it from reposting whatever the 9 AM run just posted — it
// naturally picks the next-newest unused story, or skips if there isn't
// one yet.
import { runDailyFlow } from "./pipeline/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [9, 12];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
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

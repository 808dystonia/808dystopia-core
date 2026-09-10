// Cron entry point (Render invokes this via `npm start`, not
// pipeline/index.js directly). Render's cron schedule is a fixed UTC time
// with no timezone/DST concept, but the posting target is 9 AM
// America/Chicago year-round — 9 AM CDT and 9 AM CST are different UTC
// times. Rather than try to compute that offset ourselves (and get it
// wrong on the two DST-transition days), this fires hourly and only lets
// the real run through during the Chicago-local 9 AM hour: Intl's
// timezone conversion already uses the IANA tz database, which tracks DST
// transitions correctly without any manual date math.
import { runDailyFlow } from "./pipeline/index.js";

function currentChicagoHour() {
  const hourString = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hourString);
}

const hour = currentChicagoHour();
if (hour !== 9) {
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

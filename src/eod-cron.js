// Cron entry point for the EOD brief (the GitHub Actions workflow invokes
// this via `npm run eod-brief`). Same DST-safe hourly-gate approach as
// the other two pipelines — see cron.js's comment for the reasoning —
// just gated to the 9 PM Chicago hour instead.
import { runEodBrief } from "./eod-brief/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && hour !== 21) {
  console.log(`Not the 9 PM Chicago hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runEodBrief()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

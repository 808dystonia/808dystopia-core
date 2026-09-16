// Cron entry point for the daily budget check (the GitHub Actions
// workflow invokes this via `npm run budget`). Same DST-safe hourly-gate
// approach as the other pipelines -- see eod-cron.js's comment for the
// reasoning. Runs at 8 PM Chicago, an hour ahead of the EOD brief, so a
// day's spending has mostly landed before the check runs.
import { runBudgetCheck } from "./budget/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && hour !== 20) {
  console.log(`Not the 8 PM Chicago hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runBudgetCheck()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

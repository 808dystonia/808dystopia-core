// Cron entry point for the morning site-sync (the GitHub Actions workflow
// invokes this via `npm run morning-sync`). Same DST-safe hourly-gate
// approach as the other pipelines — see cron.js's comment for the
// reasoning — gated to 10 AM Chicago time, giving Grok's own scheduled
// morning drop time to have already landed in #underground-news.
import { runMorningSync } from "./morning-sync/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const TARGET_HOUR = 10;

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && hour !== TARGET_HOUR) {
  console.log(`Not the scheduled morning-sync hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runMorningSync()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

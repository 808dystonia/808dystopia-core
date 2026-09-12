// Cron entry point for the 9 AM/1 PM/5 PM Pinterest pin (the GitHub
// Actions workflow invokes this via `npm run pin-post`). Same DST-safe
// hourly-gate approach as the other pipelines — see cron.js's comment
// for the reasoning — just gated to three target hours instead of one,
// same pattern as the carousel's own POST_HOURS list.
import { runPinPost } from "./pin-post/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [9, 13, 17];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runPinPost()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

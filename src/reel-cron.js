// Cron entry point for the Reel pipeline (the GitHub Actions workflow
// invokes this via `npm run reel`, not reels/index.js directly). Same
// DST-safe approach as the news carousel's cron.js — see that file's
// comment for the reasoning — just gated to five target hours instead of
// one, same pattern as the carousel's own POST_HOURS list. Scaled up from
// 2x/day (15, 19): content supply isn't the constraint (146 watchlist
// artists, only 5 ever used for a Reel) -- the two real things to watch
// at this volume are YouTube Data API quota (10,000 units/day, 100 per
// search.list call) and the cookie-authenticated download account's
// exposure to YouTube's bot detection, neither a hard wall today.
import { runDailyReelFlow } from "./reels/index.js";
import { currentChicagoHour } from "./util/chicagoHour.js";

const POST_HOURS = [10, 12, 14, 16, 19];

const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
const hour = currentChicagoHour();
if (isScheduledRun && !POST_HOURS.includes(hour)) {
  console.log(`Not a scheduled posting hour (currently ${hour}:00 local) — skipping this run.`);
  process.exit(0);
}

runDailyReelFlow()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

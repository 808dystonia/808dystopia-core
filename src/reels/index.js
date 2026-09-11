// Daily Reel pipeline logic. Invoked by src/reel-cron.js (the GitHub
// Actions entry point, which gates the scheduled trigger to the 7 PM
// Chicago hour) — running this file directly always runs immediately,
// same posture as the news carousel's pipeline/index.js.
//
// Steps 2+ are currently stubs — see the individual files in this folder.
//
// #reels turned out to be a static artist/producer watchlist, not a
// manual day-by-day request queue (see 1-get-watchlist.js) — so this
// still needs to pick which watchlist artist to feature today (checking
// the Sheet log so one isn't immediately re-featured) before running the
// rest of the pipeline for that pick.
//
// Failure handling (per spec): if any step fails for the selected
// artist — no video found, no transcript available, video flagged, etc.
// — that's not a whole-day failure. Fall back to the next artist in the
// watchlist and retry the pipeline for that one instead. If every
// candidate fails, skip posting for the day entirely — no error alert,
// fully hands-off.
import "dotenv/config";
import { getArtistWatchlist } from "./1-get-watchlist.js";
import { findVideo } from "./2-find-video.js";
import { selectHighlight } from "./3-select-highlight.js";
import { processClip } from "./4-process-clip.js";
import { buildReelCaption } from "./5-build-caption.js";
import { publishReel } from "./6-publish.js";
import { logReelOutcome } from "./7-log-and-report.js";

export async function runDailyReelFlow() {
  throw new Error("not implemented: runDailyReelFlow");
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyReelFlow()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

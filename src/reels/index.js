// Daily Reel pipeline logic. Invoked by src/reel-cron.js (the GitHub
// Actions entry point, which gates the scheduled trigger to the 7 PM
// Chicago hour) — running this file directly always runs immediately,
// same posture as the news carousel's pipeline/index.js.
//
// Steps 2+ are currently stubs — see the individual files in this folder.
//
// Failure handling (per spec): if any step fails for the selected
// request — no video found, no transcript available, video flagged,
// etc. — that's not a whole-day failure. Fall back to the next request
// in the #reels queue and retry the pipeline for that one instead. If
// every queued request fails, skip posting for the day entirely — no
// error alert, fully hands-off.
import "dotenv/config";
import { getReelRequests } from "./1-select-request.js";
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

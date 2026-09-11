// Daily Reel pipeline logic. Invoked by src/reel-cron.js (the GitHub
// Actions entry point, which gates the scheduled trigger to the 7 PM
// Chicago hour) — running this file directly always runs immediately,
// same posture as the news carousel's pipeline/index.js.
//
// #reels turned out to be a static artist/producer watchlist, not a
// manual day-by-day request queue (see 1-get-watchlist.js) — the
// watchlist only names who, not what to feature, and doesn't say who
// should go today. Rather than track "recently featured artist" state
// separately, this shuffles the watchlist into a random order each run
// and walks it — natural variety over time, without a second dedup
// dimension beyond the spec's actual hard rule (never repost a used
// clip, which is genuinely per-video, not per-artist — see
// isVideoAlreadyUsed in clients/googleSheets.js).
//
// Failure handling (per spec): if any step fails for the selected
// artist — no video found, no highlight worth featuring, clip
// processing failed, etc. — that's not a whole-day failure. Fall back
// to the next artist in the (shuffled) watchlist and retry the pipeline
// for that one instead. If every candidate fails, or the time budget
// below runs out first, skip posting for the day entirely — no error
// alert, fully hands-off. A publish-stage failure (step 6) does NOT
// fall back to another candidate, though — same as the carousel's
// runDailyFlow, since redoing all the upstream work (re-search,
// re-transcribe, re-render the clip) for what's likely a transient
// publish/network issue isn't worth it inside a time-boxed job.
import "dotenv/config";
import { getArtistWatchlist } from "./1-get-watchlist.js";
import { findVideo } from "./2-find-video.js";
import { selectHighlight } from "./3-select-highlight.js";
import { processClip } from "./4-process-clip.js";
import { buildReelCaption } from "./5-build-caption.js";
import { publishReel } from "./6-publish.js";
import { logReelOutcome } from "./7-log-and-report.js";
import { readReelLogRows, isVideoAlreadyUsed } from "../clients/googleSheets.js";

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Leaves headroom inside the 30-minute job timeout (daily-reel.yml) for
// the final publish + log steps once a candidate is actually chosen,
// rather than risking the hard timeout killing the process mid-download/
// mid-transcription on some later candidate.
const TIME_BUDGET_MS = 25 * 60 * 1000;

// Walks watchlist artists in random order: find a video, skip it if
// already posted before, transcribe + pick a highlight, process the clip,
// build the caption. A candidate only "wins" once all of that succeeds —
// mirrors the carousel's selectPublishableArticle, which also silently
// skips failed candidates rather than logging each attempt (only the
// final winning selection, or a final "nothing worked" outcome, gets a
// log row).
export async function selectReelCandidate() {
  const startedAt = Date.now();
  const [watchlist, logRows] = await Promise.all([getArtistWatchlist(), readReelLogRows()]);
  const candidates = shuffle(watchlist);

  for (const artist of candidates) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    let video;
    try {
      video = await findVideo(artist);
    } catch (err) {
      console.log(`findVideo(${artist}) failed:`, err.message);
      continue;
    }
    if (!video || isVideoAlreadyUsed(logRows, video.videoId)) continue;

    try {
      const highlighted = await selectHighlight(video);
      const processed = await processClip(highlighted);
      const caption = await buildReelCaption(processed);
      return { video: processed, caption };
    } catch (err) {
      console.log(`pipeline failed for ${artist} (${video.videoId}):`, err.message);
      continue;
    }
  }
  return null;
}

export async function runDailyReelFlow() {
  const selected = await selectReelCandidate();
  if (!selected) {
    return logReelOutcome({
      video: null,
      status: "skipped",
      note: "No usable video found for any watchlist artist today.",
    });
  }
  const { video, caption } = selected;

  try {
    const result = await publishReel({ clipPath: video.clipPath, caption });
    // A dry run (REEL_PUBLISH off) must never log as "posted" — that
    // status is what isVideoAlreadyUsed checks for dedup, so logging a
    // dry run that way would permanently block the real post later.
    const status = result.published ? "posted" : "skipped";
    return logReelOutcome({ video, status, note: result?.note || "" });
  } catch (err) {
    console.log("publishReel failed:", err.message);
    return logReelOutcome({ video, status: "failed-and-retried", note: err.message });
  }
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

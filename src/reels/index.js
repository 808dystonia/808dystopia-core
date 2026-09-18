// Reel selection and IG/FB publishing. Confirmed posts survive follow-up failures.
import "dotenv/config";
import { config } from "../config.js";
import { contentKey, claimedPosts, bestEffort } from "../ops/publishing.js";
import { finishPost } from "../ops/followups.js";
import { postComment } from "../clients/instagram.js";
import { getWatchlistAndTikTokUrls } from "./1-get-watchlist.js";
import { findVideo } from "./2-find-video.js";
import { selectHighlight } from "./3-select-highlight.js";
import { processClip } from "./4-process-clip.js";
import { buildReelCaption } from "./5-build-caption.js";
import { publishReel } from "./6-publish.js";
import { logReelOutcome } from "./7-log-and-report.js";
import { crosspostReelToFacebook } from "./8-crosspost-facebook.js";
import { readReelLogRows, isVideoAlreadyUsed } from "../clients/googleSheets.js";
import { getTikTokClip } from "../clients/tiktok.js";
import { describeError } from "../util/describeError.js";

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

// Shared tail of the pipeline once a candidate video is in hand (curated
// TikTok link or watchlist-artist search result alike): transcribe, pick
// a highlight, process the clip, build the caption. Returns null on any
// failure so the caller can fall through to the next candidate, same as
// the carousel's selectPublishableArticle.
async function finishCandidate(video, label) {
  try {
    const highlighted = await selectHighlight(video);
    const processed = await processClip(highlighted);
    const caption = await buildReelCaption(processed);
    return { video: processed, caption };
  } catch (err) {
    console.log(`pipeline failed for ${label} (${video.videoId}):`, describeError(err));
    return null;
  }
}

// Curated TikTok links (pasted into #tv) go first: a human or Grok
// already picked these as worth featuring, a stronger signal than the
// keyword-search fallback below -- then walks watchlist artists in
// random order, finding a video per artist. A candidate only "wins" once
// the whole tail (transcribe/highlight/process/caption) succeeds.
export async function selectReelCandidate() {
  const startedAt = Date.now();
  const [{ artists, tiktokUrls }, logRows] = await Promise.all([getWatchlistAndTikTokUrls(), readReelLogRows()]);

  const claims = config.reelPublish ? await claimedPosts("reel") : {};
  for (const url of tiktokUrls) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    let video;
    try {
      video = await getTikTokClip(url);
    } catch (err) {
      console.log(`getTikTokClip(${url}) failed:`, describeError(err));
      continue;
    }
    if (!video || isVideoAlreadyUsed(logRows, video.videoId) || claims[contentKey(video.videoId)]) continue;

    const result = await finishCandidate(video, url);
    if (result) return result;
  }

  const candidates = shuffle(artists);
  for (const artist of candidates) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    let video;
    try {
      video = await findVideo(artist);
    } catch (err) {
      console.log(`findVideo(${artist}) failed:`, describeError(err));
      continue;
    }
    if (!video || isVideoAlreadyUsed(logRows, video.videoId) || claims[contentKey(video.videoId)]) continue;

    const result = await finishCandidate(video, artist);
    if (result) return result;
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
    const result = await publishReel({ clipPath: video.clipPath, caption, identity: video.videoId,
      metadata: { artist: video.artist || '', title: video.title || '', topic: video.contentType || 'clip', format: 'reel' } });
    return await finishPost({ pipeline: 'reel', result,
      comment: () => postComment(result.mediaId, caption.hashtags),
      log: () => logReelOutcome({ video, status: result.published ? 'posted' : 'skipped', note: result.note }),
      facebook: () => crosspostReelToFacebook({ videoUrl: result.videoUrl, message: caption.caption }),
    });
  } catch (err) {
    await bestEffort(() => logReelOutcome({ video, status: 'failed', note: 'Publishing interrupted; inspect operational state before retrying.' }));
    throw err;
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

// Step 7: log the outcome to the Reels sheet tab (config.sheets.reelsTab —
// a separate tab from the news carousel's, same spreadsheet) so a used
// video is never reposted. isVideoAlreadyUsed (clients/googleSheets.js) is
// what reels/index.js's orchestration checks before spending steps 2-6 on
// a candidate.
//
// Runs for every outcome, not just successful posts — same "log
// everything" posture as the carousel's pipeline/8-log-and-report.js: a
// skip/failure still needs a row for a human reviewing the sheet to see
// what happened, even though only "posted" rows affect dedup.
import { appendReelLogRow } from "../clients/googleSheets.js";

// CT (DST handled by the IANA zone, not a fixed offset) matches the 7 PM
// CT posting schedule this pipeline runs on — same approach as the
// carousel's own timestamp helper.
function ctTimestamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/Chicago" }).replace(" ", "T");
}

export async function logReelOutcome({ video, status, note }) {
  const row = {
    timestamp: ctTimestamp(),
    artist: video?.artist || "",
    videoId: video?.videoId || "",
    highlightRange: video?.highlight ? `${video.highlight.startSeconds}-${video.highlight.endSeconds}` : "",
    status,
    note: note || "",
  };
  await appendReelLogRow(row);
  return row;
}

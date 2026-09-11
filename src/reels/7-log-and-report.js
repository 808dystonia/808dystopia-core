// Step 7: log the outcome to the shared Google Sheet (a separate tab —
// config.sheets.reelsTab / GOOGLE_SHEETS_REELS_TAB — same spreadsheet as
// the news carousel, tracked independently) so a used clip is never
// reposted. Same dedup principle and "log every outcome, not just
// successful posts" posture as the news carousel's 8-log-and-report.js.
// TODO: implement once the row schema is settled — likely
// timestamp / artist / video URL or ID / clip time range / status / note,
// mirroring the news log's shape closely enough to reuse
// src/clients/googleSheets.js's read/append helpers with a different tab.
export async function logReelOutcome(_report) {
  throw new Error("not implemented: logReelOutcome");
}

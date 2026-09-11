// Step 8: append the outcome (timestamp, article, status) to the Google
// Sheet log. Runs for every outcome — posted, skipped, or
// failed-and-retried — not just successful posts: the log is also how
// selectPublishableArticle's dedup works (isAlreadyPosted only looks at
// "posted" rows), so a skip/failure still needs a row for a human
// reviewing the sheet to see what happened, even though it doesn't affect
// dedup.
import { appendLogRow } from "../clients/googleSheets.js";

// The sheet is a human-readable log, not just dedup input — CT (with DST
// handled by the IANA zone, not a fixed offset) matches the 9 AM/12 PM CT
// posting schedule the rest of the project runs on.
function ctTimestamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/Chicago" }).replace(" ", "T");
}

export async function logAndReport({ classified, status, note }) {
  const row = {
    timestamp: ctTimestamp(),
    artist: classified?.artist || "",
    title: classified?.title || "",
    status,
    note: note || "",
  };
  await appendLogRow(row);
  return row;
}

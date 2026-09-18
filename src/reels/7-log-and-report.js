// Mirror Reel outcomes to Sheets; UTC ISO timestamps preserve exact instants.
import { appendReelLogRow } from "../clients/googleSheets.js";

// Store UTC; dashboard display converts through America/Chicago.
function ctTimestamp() {
  return new Date().toISOString();
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

// Human-readable Sheets mirror. Durable dedup also lives on automation-state.
import { appendLogRow } from "../clients/googleSheets.js";

// The sheet is a human-readable log, not just dedup input — CT (with DST
// handled by the IANA zone, not a fixed offset) matches the 9 AM/12 PM CT
// posting schedule the rest of the project runs on.
function ctTimestamp() {
  return new Date().toISOString();
}

export async function logAndReport({ candidate, classified, status, note }) {
  const row = {
    timestamp: ctTimestamp(),
    artist: classified?.artist || "",
    title: classified?.title || "",
    status,
    note: note || "",
    sourceText: candidate?.text || "",
  };
  await appendLogRow(row);
  return row;
}

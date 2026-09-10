// Google Sheets, via Composio — log of previously-posted articles.
// Sheet layout (columns A:E, row 1 = header):
//   timestamp | artist | title | status | note
// artist/title are Gemini's extracted fields (step 2) — dedup happens on
// these, not on raw Discord text, since the same story gets reworded across
// different days' digests. status is one of:
// posted / skipped / failed-and-retried (set by step 8).
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function readLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool("GOOGLESHEETS_BATCH_GET", {
    spreadsheet_id: config.sheets.id,
    ranges: [`${config.sheets.tab}!A:E`],
  });
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    artist: row[1] || "",
    title: row[2] || "",
    status: row[3] || "",
    note: row[4] || "",
  }));
}

export async function appendLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool("GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", {
    spreadsheetId: config.sheets.id,
    range: `${config.sheets.tab}!A:E`,
    valueInputOption: "USER_ENTERED",
    values: [[row.timestamp, row.artist, row.title, row.status, row.note || ""]],
  });
}

// Case-insensitive artist+title match against previously-posted rows.
export function isAlreadyPosted(logRows, artist, title) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const a = norm(artist);
  const t = norm(title);
  if (!a && !t) return false;
  return logRows.some(
    (row) => row.status === "posted" && norm(row.artist) === a && norm(row.title) === t
  );
}

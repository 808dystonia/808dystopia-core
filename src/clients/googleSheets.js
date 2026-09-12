// Google Sheets, via Composio — log of previously-posted articles.
// Sheet layout (columns A:F, row 1 = header):
//   timestamp | artist | title | status | note | sourceText
// artist/title are step 2's extracted fields; sourceText is the raw
// Discord candidate text (see isAlreadyPosted for why both are needed).
// status is one of: posted / skipped / failed-and-retried (set by step 8).
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function readLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.tab}!A:F`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    artist: row[1] || "",
    title: row[2] || "",
    status: row[3] || "",
    note: row[4] || "",
    sourceText: row[5] || "",
  }));
}

export async function appendLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.tab}!A:F`,
      valueInputOption: "USER_ENTERED",
      values: [[row.timestamp, row.artist, row.title, row.status, row.note || "", row.sourceText || ""]],
    },
    config.sheets.connectedAccountId || undefined
  );
}

// Case-insensitive artist+title match against previously-posted rows, OR an
// exact match on the raw source text. Confirmed live: relying on artist+title
// alone let the same karrahbooo story post twice in one day (9 AM and 12 PM)
// with two different headlines — the Discord digest bullet was byte-identical
// both times, but DeepSeek's classification (temperature 0.1, not 0) phrased
// the title differently between the two separate calls, so the exact-string
// title match missed it. sourceText matching is the same-day safety net for
// that; artist+title still carries the original cross-day case, where a
// story that's genuinely reworded in a later digest has different raw text
// but should still classify to a recognizably similar artist+title.
export function isAlreadyPosted(logRows, { artist, title, sourceText }) {
  const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const a = norm(artist);
  const t = norm(title);
  const src = norm(sourceText);
  return logRows.some((row) => {
    if (row.status !== "posted") return false;
    if (src && norm(row.sourceText) === src) return true;
    return (a || t) && norm(row.artist) === a && norm(row.title) === t;
  });
}

// Reel pipeline's dedup/outcome log -- a separate tab (config.sheets.reelsTab)
// in the same spreadsheet, with its own column schema (row 1 = header):
//   timestamp | artist | videoId | highlightRange | status | note
// A Reel's identity is a YouTube video, not an LLM-classified title (unlike
// the carousel above), so this doesn't need the artist+title / sourceText
// dance -- videoId alone is already a stable, non-drifting dedup key.
export async function readReelLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.reelsTab}!A:F`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    artist: row[1] || "",
    videoId: row[2] || "",
    highlightRange: row[3] || "",
    status: row[4] || "",
    note: row[5] || "",
  }));
}

export async function appendReelLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.reelsTab}!A:F`,
      valueInputOption: "USER_ENTERED",
      values: [[row.timestamp, row.artist, row.videoId, row.highlightRange, row.status, row.note || ""]],
    },
    config.sheets.connectedAccountId || undefined
  );
}

// A video counts as "used" once it's been posted, regardless of which
// highlight window was picked -- the spec's "never repost a used clip"
// rule is about the source video, not the specific timestamp range, so
// picking a different window into an already-posted video is still a
// repost.
export function isVideoAlreadyUsed(logRows, videoId) {
  if (!videoId) return false;
  return logRows.some((row) => row.status === "posted" && row.videoId === videoId);
}

// Pin pipeline's dedup/outcome log -- a separate tab (config.sheets.pinsTab)
// in the same spreadsheet, with its own column schema (row 1 = header):
//   timestamp | artist | album | pinId | status | note
// An album's identity is artist+album name (Spotify has no single stable
// ID this pipeline already carries end to end the way a Reel's videoId
// is), so dedup matches on that pair rather than a single key.
export async function readPinLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.pinsTab}!A:F`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    artist: row[1] || "",
    album: row[2] || "",
    pinId: row[3] || "",
    status: row[4] || "",
    note: row[5] || "",
  }));
}

export async function appendPinLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.pinsTab}!A:F`,
      valueInputOption: "USER_ENTERED",
      values: [[row.timestamp, row.artist, row.album, row.pinId || "", row.status, row.note || ""]],
    },
    config.sheets.connectedAccountId || undefined
  );
}

export function isAlbumAlreadyPinned(logRows, { artist, album }) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const a = norm(artist);
  const t = norm(album);
  return logRows.some((row) => row.status === "posted" && norm(row.artist) === a && norm(row.album) === t);
}

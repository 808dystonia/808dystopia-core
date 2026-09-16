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

// Sheets reformats the ISO-ish timestamp logAndReport writes into its own
// display format on read-back (USER_ENTERED recognizes it as a date/time) —
// space separator, no zero-padding on the hour ("2026-09-13 8:14:22") — so
// plain Date.parse rejects it. Pad the hour and treat as UTC; a same-day/
// same-artist window only needs day-level precision, not exact offset.
function parseTimestampMs(ts) {
  if (!ts) return NaN;
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  return Date.parse(`${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:${s}Z`);
}

const SENSITIVE_SAME_ARTIST_WINDOW_MS = 72 * 60 * 60 * 1000;

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
//
// `sensitive: true` adds a third, stricter check for claims of death/
// violence/arrest/hospitalization: ANY posted row for the same artist within
// the last 72h is treated as a duplicate, regardless of title/sourceText
// match. Confirmed live: a "Bloodhound Q50 allegedly shot" post was
// followed under an hour later by a differently-worded "reportedly shot and
// killed" story from a separately-phrased digest bullet — different title,
// different sourceText, so neither existing check caught it, and an
// unconfirmed escalation went out on the real account with no human
// review. This is deliberately artist-only (no title/sourceText match
// required) since the whole failure mode is two DIFFERENT tellings of what
// may be the same event.
export function isAlreadyPosted(logRows, { artist, title, sourceText, sensitive }) {
  const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const a = norm(artist);
  const t = norm(title);
  const src = norm(sourceText);
  return logRows.some((row) => {
    if (row.status !== "posted") return false;
    if (src && norm(row.sourceText) === src) return true;
    if ((a || t) && norm(row.artist) === a && norm(row.title) === t) return true;
    if (sensitive && a && norm(row.artist) === a) {
      const rowMs = parseTimestampMs(row.timestamp);
      if (!isNaN(rowMs) && Date.now() - rowMs < SENSITIVE_SAME_ARTIST_WINDOW_MS) return true;
    }
    return false;
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

// RapToonz's dedup/outcome log -- a separate tab (config.sheets.raptoonzTab)
// in the same spreadsheet, its own column schema (row 1 = header):
//   timestamp | rapper | style | messageId | pinId | status | note
// Identity is the Discord message id (the generated image Grok posted) --
// like the Reel pipeline's videoId, a stable non-drifting dedup key,
// rather than the rapper+style text pair (which can't tell two distinct
// Grok generations of the same pairing apart, and isn't this pipeline's
// actual "never repost the same image" rule anyway).
export async function readRaptoonzLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.raptoonzTab}!A:G`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    rapper: row[1] || "",
    style: row[2] || "",
    messageId: row[3] || "",
    pinId: row[4] || "",
    status: row[5] || "",
    note: row[6] || "",
  }));
}

export async function appendRaptoonzLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.raptoonzTab}!A:G`,
      valueInputOption: "USER_ENTERED",
      values: [
        [row.timestamp, row.rapper, row.style, row.messageId || "", row.pinId || "", row.status, row.note || ""],
      ],
    },
    config.sheets.connectedAccountId || undefined
  );
}

export function isRaptoonzMessageAlreadyPosted(logRows, messageId) {
  if (!messageId) return false;
  return logRows.some((row) => row.status === "posted" && row.messageId === messageId);
}

// BoxArt's dedup/outcome log -- a separate tab (config.sheets.boxartTab) in
// the same spreadsheet, its own column schema (row 1 = header):
//   timestamp | artist | messageId | pinId | status | note
// Identity is the Discord message id (the curated photo drop), same
// reasoning as RapToonz's own messageId dedup.
export async function readBoxArtLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.boxartTab}!A:F`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    artist: row[1] || "",
    messageId: row[2] || "",
    pinId: row[3] || "",
    status: row[4] || "",
    note: row[5] || "",
  }));
}

export async function appendBoxArtLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.boxartTab}!A:F`,
      valueInputOption: "USER_ENTERED",
      values: [[row.timestamp, row.artist, row.messageId || "", row.pinId || "", row.status, row.note || ""]],
    },
    config.sheets.connectedAccountId || undefined
  );
}

export function isBoxArtMessageAlreadyPosted(logRows, messageId) {
  if (!messageId) return false;
  return logRows.some((row) => row.status === "posted" && row.messageId === messageId);
}

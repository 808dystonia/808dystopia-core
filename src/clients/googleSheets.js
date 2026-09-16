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
//
// Unlike the other pipelines' tabs (each hand-created once via a one-off
// live call before its workflow ever ran), this one provisions itself on
// first use: GOOGLESHEETS_ADD_SHEET's own `title` param is silently
// ignored (creates "SheetN" instead) -- confirmed against this exact
// spreadsheet setting up RapToonz's tab -- so this creates it unnamed,
// renames it via GOOGLESHEETS_UPDATE_SHEET_PROPERTIES, then writes the
// header row. Checked (and created, if missing) on every read -- cheap
// at this pipeline's 3x/day volume, and avoids a manual bootstrap step a
// workflow_dispatch run can't do from a feature branch (GitHub only
// dispatches a workflow that already exists on the default branch).
let boxartTabEnsured = false;

async function ensureBoxArtTab() {
  if (boxartTabEnsured) return;

  const { sheet_names: names = [] } = await runTool(
    "GOOGLESHEETS_GET_SHEET_NAMES",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  if (names.includes(config.sheets.boxartTab)) {
    boxartTabEnsured = true;
    return;
  }

  const added = await runTool(
    "GOOGLESHEETS_ADD_SHEET",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  // Confirmed failing live with the `.properties.sheetId` path this
  // originally used ("could not find new sheetId in ADD_SHEET response") --
  // Composio's own tool docs put it directly at `.sheetId`, not nested
  // under `.properties`. Checking both rather than committing to a second
  // guess.
  const addSheet = added?.replies?.[0]?.addSheet;
  const sheetId = addSheet?.sheetId ?? addSheet?.properties?.sheetId;
  if (sheetId === undefined) throw new Error("BoxArt tab setup: could not find new sheetId in ADD_SHEET response");

  await runTool(
    "GOOGLESHEETS_UPDATE_SHEET_PROPERTIES",
    {
      spreadsheet_id: config.sheets.id,
      updateSheetProperties: { properties: { sheetId, title: config.sheets.boxartTab }, fields: "title" },
    },
    config.sheets.connectedAccountId || undefined
  );

  await runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.boxartTab}!A:F`,
      valueInputOption: "USER_ENTERED",
      values: [["timestamp", "artist", "messageId", "pinId", "status", "note"]],
    },
    config.sheets.connectedAccountId || undefined
  );

  boxartTabEnsured = true;
}

export async function readBoxArtLogRows() {
  if (!config.sheets.id) return [];
  await ensureBoxArtTab();

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
  await ensureBoxArtTab();

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

// Budget pipeline's two tabs (config.sheets.financeTab / config.sheets.budgetTab),
// same spreadsheet as everything else. Two tabs because they're fed by two
// different sources: Finances is an append-only feed an external Grok
// automation writes to (outside this repo entirely -- see src/budget/),
// while Budget is a small table the user edits by hand in Sheets whenever
// a monthly limit changes. Both self-provision on first read (same
// pattern as ensureBoxArtTab above), so neither the Grok automation nor
// the user is blocked on a manual setup step before this pipeline's own
// cron has ever run.
let financeTabEnsured = false;

async function ensureFinanceTab() {
  if (financeTabEnsured) return;

  const { sheet_names: names = [] } = await runTool(
    "GOOGLESHEETS_GET_SHEET_NAMES",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  if (names.includes(config.sheets.financeTab)) {
    financeTabEnsured = true;
    return;
  }

  const added = await runTool(
    "GOOGLESHEETS_ADD_SHEET",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  const addSheet = added?.replies?.[0]?.addSheet;
  const sheetId = addSheet?.sheetId ?? addSheet?.properties?.sheetId;
  if (sheetId === undefined) throw new Error("Finance tab setup: could not find new sheetId in ADD_SHEET response");

  await runTool(
    "GOOGLESHEETS_UPDATE_SHEET_PROPERTIES",
    {
      spreadsheet_id: config.sheets.id,
      updateSheetProperties: { properties: { sheetId, title: config.sheets.financeTab }, fields: "title" },
    },
    config.sheets.connectedAccountId || undefined
  );

  await runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.financeTab}!A:E`,
      valueInputOption: "USER_ENTERED",
      values: [["timestamp", "category", "amount", "type", "note"]],
    },
    config.sheets.connectedAccountId || undefined
  );

  financeTabEnsured = true;
}

// Row shape the external Grok automation writes: timestamp | category |
// amount | type (income/expense) | note. amount is a plain decimal dollar
// figure (e.g. "42.50"), not minor units -- this is a human/Grok-edited
// sheet, not a payments ledger like Era Context's account balances.
export async function readFinanceRows() {
  if (!config.sheets.id) return [];
  await ensureFinanceTab();

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.financeTab}!A:E`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    category: row[1] || "",
    amount: parseFloat(row[2]) || 0,
    type: (row[3] || "").trim().toLowerCase(),
    note: row[4] || "",
  }));
}

let budgetTabEnsured = false;

async function ensureBudgetTab() {
  if (budgetTabEnsured) return;

  const { sheet_names: names = [] } = await runTool(
    "GOOGLESHEETS_GET_SHEET_NAMES",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  if (names.includes(config.sheets.budgetTab)) {
    budgetTabEnsured = true;
    return;
  }

  const added = await runTool(
    "GOOGLESHEETS_ADD_SHEET",
    { spreadsheet_id: config.sheets.id },
    config.sheets.connectedAccountId || undefined
  );
  const addSheet = added?.replies?.[0]?.addSheet;
  const sheetId = addSheet?.sheetId ?? addSheet?.properties?.sheetId;
  if (sheetId === undefined) throw new Error("Budget tab setup: could not find new sheetId in ADD_SHEET response");

  await runTool(
    "GOOGLESHEETS_UPDATE_SHEET_PROPERTIES",
    {
      spreadsheet_id: config.sheets.id,
      updateSheetProperties: { properties: { sheetId, title: config.sheets.budgetTab }, fields: "title" },
    },
    config.sheets.connectedAccountId || undefined
  );

  await runTool(
    "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
    {
      spreadsheetId: config.sheets.id,
      range: `${config.sheets.budgetTab}!A:B`,
      valueInputOption: "USER_ENTERED",
      values: [["category", "monthly_limit"]],
    },
    config.sheets.connectedAccountId || undefined
  );

  budgetTabEnsured = true;
}

// Hand-edited by the user in Sheets whenever a monthly limit changes --
// category | monthly_limit (plain dollar figure, same convention as
// Finances' amount column). A category with spending in Finances but no
// row here has nothing to check against, so 2-compute-status.js reports
// it as unbudgeted rather than alerting on it.
export async function readBudgetLimits() {
  if (!config.sheets.id) return [];
  await ensureBudgetTab();

  const result = await runTool(
    "GOOGLESHEETS_BATCH_GET",
    { spreadsheet_id: config.sheets.id, ranges: [`${config.sheets.budgetTab}!A:B`] },
    config.sheets.connectedAccountId || undefined
  );
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    category: row[0] || "",
    monthlyLimit: parseFloat(row[1]) || 0,
  }));
}

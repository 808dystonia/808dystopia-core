// Google Sheets, via Composio — log of previously-posted articles.
// Sheet layout (columns A:D, row 1 = header):
//   timestamp | articleKey | status | note
// articleKey is the article's source URL when one was found in the Discord
// message, otherwise the Discord message id. status is one of:
// posted / skipped / failed-and-retried (set by step 8).
import { config } from "../config.js";
import { runTool } from "./composio.js";

export async function readLogRows() {
  if (!config.sheets.id) return [];

  const result = await runTool("GOOGLESHEETS_BATCH_GET", {
    spreadsheet_id: config.sheets.id,
    ranges: [`${config.sheets.tab}!A:D`],
  });
  const values = result?.valueRanges?.[0]?.values || [];
  return values.slice(1).map((row) => ({
    timestamp: row[0] || "",
    articleKey: row[1] || "",
    status: row[2] || "",
    note: row[3] || "",
  }));
}

export async function appendLogRow(row) {
  if (!config.sheets.id) return null;

  return runTool("GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", {
    spreadsheetId: config.sheets.id,
    range: `${config.sheets.tab}!A:D`,
    valueInputOption: "USER_ENTERED",
    values: [[row.timestamp, row.articleKey, row.status, row.note || ""]],
  });
}

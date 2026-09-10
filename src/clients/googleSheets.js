import { config } from "../config.js";
import { runTool } from "./composio.js";

function tab() {
  return config.sheetsTab || "carousel_log";
}

export async function readLogRows() {
  if (!config.sheetsId) return [];
  const raw = await runTool("GOOGLESHEETS_BATCH_GET", {
    spreadsheet_id: config.sheetsId,
    ranges: [`${tab()}!A:H`],
  });
  const values = raw?.valueRanges?.[0]?.values || raw?.values || [];
  return values.slice(1).map((row) => ({
    date: row[0] || "",
    artist: row[1] || "",
    title: row[2] || "",
    type: row[3] || "",
    slug: row[4] || "",
    mediaId: row[5] || "",
    status: row[6] || "",
    note: row[7] || "",
  }));
}

export async function appendLogRow(row) {
  if (!config.sheetsId) return null;
  return runTool("GOOGLESHEETS_VALUES_APPEND", {
    spreadsheet_id: config.sheetsId,
    range: `${tab()}!A:H`,
    valueInputOption: "USER_ENTERED",
    values: [[
      row.date,
      row.artist,
      row.title,
      row.type,
      row.slug,
      row.mediaId || "",
      row.status,
      row.note || "",
    ]],
  });
}

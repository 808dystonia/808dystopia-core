// One-off provisioning script -- creates the "BoxArt" tab in the shared
// Google Sheet, matching the header row the other pipelines' tabs use.
// GOOGLESHEETS_ADD_SHEET's own `title` param is silently ignored (creates
// "SheetN" instead) -- confirmed against this exact spreadsheet when
// RapToonz's tab was set up -- so this adds the sheet unnamed, then
// renames it via GOOGLESHEETS_UPDATE_SHEET_PROPERTIES. Deleted from the
// repo once run; not part of the pipeline itself.
import "dotenv/config";
import { runTool } from "../src/clients/composio.js";
import { config } from "../src/config.js";

const existing = await runTool(
  "GOOGLESHEETS_GET_SHEET_NAMES",
  { spreadsheet_id: config.sheets.id },
  config.sheets.connectedAccountId || undefined
);
console.log("existing tabs:", JSON.stringify(existing));

if ((existing?.sheet_names || existing?.sheetNames || []).includes(config.sheets.boxartTab)) {
  console.log(`"${config.sheets.boxartTab}" tab already exists -- nothing to do.`);
  process.exit(0);
}

const added = await runTool(
  "GOOGLESHEETS_ADD_SHEET",
  { spreadsheet_id: config.sheets.id },
  config.sheets.connectedAccountId || undefined
);
const sheetId = added?.replies?.[0]?.addSheet?.properties?.sheetId;
console.log("added sheet:", JSON.stringify(added));
if (sheetId === undefined) throw new Error("could not find new sheetId in ADD_SHEET response");

await runTool(
  "GOOGLESHEETS_UPDATE_SHEET_PROPERTIES",
  {
    spreadsheet_id: config.sheets.id,
    updateSheetProperties: { properties: { sheetId, title: config.sheets.boxartTab }, fields: "title" },
  },
  config.sheets.connectedAccountId || undefined
);
console.log(`renamed sheetId ${sheetId} to "${config.sheets.boxartTab}"`);

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
console.log("wrote header row");

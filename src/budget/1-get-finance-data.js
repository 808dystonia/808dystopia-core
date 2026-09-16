// Step 1: pull this month's transactions plus the current budget limits.
// Finances is an append-only log the Grok-side automation writes to
// (outside this repo -- see clients/googleSheets.js's own comment above
// ensureFinanceTab); Budget is a small table the user edits by hand
// whenever a limit changes. Both live in the same spreadsheet as every
// other pipeline's Sheet data.
import { readFinanceRows, readBudgetLimits } from "../clients/googleSheets.js";
import { chicagoDateString } from "../util/chicagoHour.js";

// Only the year+month is needed for "is this row in the current budget
// period" -- the exact day/time within the month doesn't matter here.
// Grok's write format isn't confirmed live yet, so this tries a strict
// ISO-date prefix first (matches the reformatted-by-Sheets style every
// other pipeline's own timestamps come back as -- see
// googleSheets.js's parseTimestampMs) and falls back to generic Date
// parsing for anything else.
function yearMonthOf(timestamp) {
  const isoMatch = (timestamp || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const parsed = new Date(timestamp);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

export async function getFinanceData() {
  const [rows, limits] = await Promise.all([readFinanceRows(), readBudgetLimits()]);
  const currentYearMonth = chicagoDateString(new Date()).slice(0, 7);

  const thisMonthRows = rows.filter((row) => yearMonthOf(row.timestamp) === currentYearMonth);
  return { thisMonthRows, limits };
}

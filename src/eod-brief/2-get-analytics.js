// Step 2: pull today's Instagram analytics (@808dystopia only for now —
// the only platform actually posting; extend here once others go live).
// Instagram's own insights API is day-granular (period="day"), so this
// uses calendar dates in Central Time rather than a rolling 24h window —
// en-CA is just a convenient locale that happens to format as YYYY-MM-DD
// (verified live), not actually about Canada.
import { getDailyInsights } from "../clients/instagram.js";

function chicagoDateString(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(date);
}

export async function getAnalytics() {
  const today = chicagoDateString(new Date());
  const yesterday = chicagoDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const instagram = await getDailyInsights(yesterday, today);
  return { instagram };
}

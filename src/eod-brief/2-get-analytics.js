// Step 2: pull today's Instagram analytics (@808dystopia only for now —
// the only platform actually posting; extend here once others go live).
// Instagram's own insights API is day-granular (period="day"), so this
// uses calendar dates in Central Time rather than a rolling 24h window.
import { getDailyInsights } from "../clients/instagram.js";
import { chicagoDateString } from "../util/chicagoHour.js";

export async function getAnalytics() {
  const today = chicagoDateString(new Date());
  const yesterday = chicagoDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const instagram = await getDailyInsights(yesterday, today);
  return { instagram };
}

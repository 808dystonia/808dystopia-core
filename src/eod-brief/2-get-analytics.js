// Step 2: pull today's Instagram + Pinterest analytics. Both APIs are
// day-granular, so this uses calendar dates in Central Time rather than a
// rolling 24h window (Pinterest's dates are technically UTC, but a
// same-day-ish window is close enough for a daily summary — not worth a
// second date-math path just for that).
import { getDailyInsights } from "../clients/instagram.js";
import { getDailyAnalytics as getPinterestAnalytics } from "../clients/pinterest.js";
import { stateStore } from "../ops/state.js";
import { chicagoDateString } from "../util/chicagoHour.js";

export async function getAnalytics() {
  const today = chicagoDateString(new Date());
  const yesterday = chicagoDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const instagram = await getDailyInsights(yesterday, today);
  const pinterest = await getPinterestAnalytics(yesterday, today);
  let weeklyPerformance = null;
  try {
    const latest = (await stateStore.read('performance')).value.latest;
    if (latest && Date.now() - Date.parse(latest.collectedAt) < 14 * 86400000) weeklyPerformance = latest;
  } catch { /* Weekly reporting is supplementary; daily metrics remain usable. */ }
  return { instagram, pinterest, weeklyPerformance };
}

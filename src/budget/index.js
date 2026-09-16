// Daily budget check. Invoked by src/budget-cron.js (the GitHub Actions
// entry point, which gates the scheduled trigger to the 8 PM Chicago
// hour) -- running this file directly always runs immediately, same
// posture as the other pipelines.
//
// Reads this month's transactions (an external Grok automation appends
// them to the Finances tab, outside this repo) against the hand-edited
// Budget limits table, then alerts on Discord only when a category is
// near or over its limit -- see 3-post-alert.js.
import "dotenv/config";
import { getFinanceData } from "./1-get-finance-data.js";
import { computeStatus } from "./2-compute-status.js";
import { postAlert } from "./3-post-alert.js";

export async function runBudgetCheck() {
  const financeData = await getFinanceData();
  const status = computeStatus(financeData);
  const alert = await postAlert(status);
  return { ...status, alert };
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runBudgetCheck()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

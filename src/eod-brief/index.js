// Daily EOD brief. Invoked by src/eod-cron.js (the GitHub Actions entry
// point, which gates the scheduled trigger to the 9 PM Chicago hour) —
// running this file directly always runs immediately, same posture as
// the other two pipelines.
//
// Unlike the carousel/reel pipelines, there's no candidate selection or
// fallback logic here — this is a single deterministic daily summary,
// not picking from a list of options, so there's nothing to retry or
// skip if a step fails cleanly (a hard failure just fails the run, same
// as any normal script — there's no "next candidate" to fall back to
// for a summary of today).
import "dotenv/config";
import { getAccomplishments } from "./1-get-accomplishments.js";
import { getAnalytics } from "./2-get-analytics.js";
import { buildRecommendations } from "./3-build-recommendations.js";
import { postBriefing } from "./4-post-briefing.js";

export async function runEodBrief() {
  const [accomplishments, analytics] = await Promise.all([getAccomplishments(), getAnalytics()]);
  const recommendations = await buildRecommendations(accomplishments, analytics);
  return postBriefing({ accomplishments, analytics, recommendations });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runEodBrief()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

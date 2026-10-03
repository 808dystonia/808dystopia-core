// Weekly "808 Trending Tuesday" chart -- top 10 rappers on Grok's #reels
// board, ranked by real Spotify follower counts, rendered
// into a branded chart image and posted to Instagram. Invoked by
// src/trending-cron.js (the GitHub Actions entry point, which gates the
// scheduled trigger to Tuesday 5 PM Chicago time) -- running this file
// directly always runs immediately, same posture as the other pipelines.
import "dotenv/config";
import { getTopTen } from "./1-get-rankings.js";
import { renderChart } from "./2-render-chart.js";
import { publishChart } from "./3-publish.js";

export async function runTrendingTuesday() {
  const rankings = await getTopTen();
  if (rankings.length === 0) {
    return { published: false, note: "No board rappers with a confident Spotify match this week." };
  }

  const { chartPath } = await renderChart(rankings);
  return publishChart({ chartPath, rankings });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runTrendingTuesday()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

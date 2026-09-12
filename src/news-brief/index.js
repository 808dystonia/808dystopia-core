// 12 PM / 6 PM underground rap news digest. Invoked by src/news-cron.js
// (the GitHub Actions entry point, which gates the scheduled trigger to
// those two Chicago hours) — running this file directly always runs
// immediately, same posture as the other pipelines.
//
// Complements, doesn't replace, the existing morning Grok-native
// scheduled task (a separate, external automation this repo has never
// controlled) — DeepSeek has no live web search of its own, so this
// pairs it with real fetched RSS articles (step 1) rather than asking it
// to generate news from nothing. Posts to the same #underground-news
// channel in the same digest format the carousel pipeline already
// reads, so these digests also feed it fresh story candidates.
import "dotenv/config";
import { getRecentArticles } from "./1-fetch-articles.js";
import { buildDigest } from "./2-build-digest.js";
import { postDigest } from "./3-post-digest.js";

export async function runNewsBrief() {
  const articles = await getRecentArticles();
  const stories = await buildDigest(articles);
  return postDigest(stories);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runNewsBrief()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

// 9 AM / 1 PM / 5 PM CT underground album cover art pin. Invoked by
// src/pin-cron.js (the GitHub Actions entry point, which gates the
// scheduled trigger to those three Chicago hours) — running this file
// directly always runs immediately, same posture as the other pipelines.
import "dotenv/config";
import { getCandidate } from "./1-get-candidate.js";
import { postPin } from "./2-post-pin.js";

export async function runPinPost() {
  const candidate = await getCandidate();
  return postPin(candidate);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runPinPost()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

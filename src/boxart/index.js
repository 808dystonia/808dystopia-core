// 11 AM / 3 PM / 7 PM CT BoxArt pin (PS1/PS2-style game-case cover of a
// female rapper/artist, photo pulled from #boxart). Invoked by
// src/boxart-cron.js (the GitHub Actions entry point, which gates the
// scheduled trigger to those three Chicago hours) -- running this file
// directly always runs immediately, same posture as the other pipelines.
import "dotenv/config";
import { getCandidate } from "./1-get-candidate.js";
import { renderCover } from "./2-render-cover.js";
import { postPin } from "./3-post-pin.js";

export async function runBoxArt() {
  const candidate = await getCandidate();
  if (!candidate) return postPin(null);

  const rendered = await renderCover(candidate);
  return postPin(candidate, rendered);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runBoxArt()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

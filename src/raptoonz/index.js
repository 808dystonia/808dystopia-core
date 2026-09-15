// 10 AM / 2 PM / 6 PM CT RapToonz pin (AI-generated rapper x cartoon-art-
// style mashup). Invoked by src/raptoonz-cron.js (the GitHub Actions
// entry point, which gates the scheduled trigger to those three Chicago
// hours) — running this file directly always runs immediately, same
// posture as the other pipelines.
import "dotenv/config";
import { getCandidate } from "./1-get-candidate.js";
import { generateMashupImage } from "./2-generate-image.js";
import { postPin } from "./3-post-pin.js";
import { appendRaptoonzLogRow } from "../clients/googleSheets.js";

export async function runRaptoonz() {
  const candidate = await getCandidate();
  if (!candidate) return postPin(null);

  let generated;
  try {
    generated = await generateMashupImage(candidate);
  } catch (err) {
    console.log("replicate image generation failed:", err.message);
    await appendRaptoonzLogRow({
      timestamp: new Date().toISOString(),
      rapper: candidate.rapper,
      style: candidate.style.name,
      status: "failed-and-retried",
      note: err.message,
    });
    return { published: false, note: `Image generation failed: ${err.message}` };
  }

  return postPin(candidate, generated);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runRaptoonz()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

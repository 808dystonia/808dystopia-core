// Daily pipeline entry point. Runs once per invocation (Render cron job).
// Wires the numbered steps together. Steps 2+ are currently stubs — see the
// individual files in this folder.
import "dotenv/config";
import { getCandidates } from "./1-select-article.js";
import { classifyArticle } from "./2-classify.js";
import { getPhoto } from "./3-get-photo.js";
import { getGeniusContent } from "./4-get-diss-content.js";
import { renderSlides } from "./5-render-slides.js";
import { buildCaption } from "./6-build-caption.js";
import { publishCarousel } from "./7-publish.js";
import { logAndReport } from "./8-log-and-report.js";
import { readLogRows, isAlreadyPosted } from "../clients/googleSheets.js";

// Walks candidates newest-first, classifying each until one isn't a repeat
// of an already-posted story (artist+title match against the Sheet log).
async function selectUnusedArticle() {
  const [candidates, logRows] = await Promise.all([getCandidates(), readLogRows()]);

  for (const candidate of candidates) {
    const classified = await classifyArticle(candidate);
    if (!isAlreadyPosted(logRows, classified.artist, classified.title)) {
      return { candidate, classified };
    }
  }
  return null;
}

export async function runDailyFlow() {
  const selected = await selectUnusedArticle();
  if (!selected) {
    return { status: "skip", note: "No unused story in the Discord heat channel." };
  }
  const { candidate, classified } = selected;

  const photo = await getPhoto(candidate);
  const genius = classified.type === "diss" ? await getGeniusContent(candidate, classified.type) : null;
  const slides = await renderSlides({ candidate, classified, photo, genius });
  const caption = buildCaption({ candidate, classified, genius });
  const result = await publishCarousel({ slides, caption });
  return logAndReport({ candidate, classified, result });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyFlow()
    .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}

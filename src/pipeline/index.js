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

// Walks candidates newest-first: classify, skip repeats of already-posted
// stories (artist+title match against the Sheet log), skip anything with no
// usable photo (Pinterest, then Google fallback — both live in getPhoto).
// A candidate only "wins" once it clears both checks.
export async function selectPublishableArticle() {
  const [candidates, logRows] = await Promise.all([getCandidates(), readLogRows()]);

  for (const candidate of candidates) {
    const classified = await classifyArticle(candidate);
    if (isAlreadyPosted(logRows, classified.artist, classified.title)) continue;

    const photo = await getPhoto(classified.artist);
    if (!photo.ok) continue;

    return { candidate, classified, photo };
  }
  return null;
}

export async function runDailyFlow() {
  const selected = await selectPublishableArticle();
  if (!selected) {
    return logAndReport({ classified: null, status: "skipped", note: "No unused story with a usable photo found." });
  }
  const { candidate, classified, photo } = selected;

  let genius = null;
  if (classified.type === "diss") {
    try {
      genius = await getGeniusContent(classified.artist, classified.title);
    } catch (err) {
      console.log("genius diss content:", err.message);
      genius = { confident: false };
    }
  }
  const slides = await renderSlides({ candidate, classified, photo, genius });
  const caption = await buildCaption({ candidate, classified });

  try {
    const result = await publishCarousel({ slides, caption });
    // A dry run (CAROUSEL_PUBLISH off) must never log as "posted" — that
    // status is what isAlreadyPosted checks for dedup, so logging a dry
    // run that way would permanently block the real post later.
    const status = result.published ? "posted" : "skipped";
    return logAndReport({ classified, status, note: result?.note || "" });
  } catch (err) {
    console.log("publishCarousel failed:", err.message);
    return logAndReport({ classified, status: "failed-and-retried", note: err.message });
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyFlow()
    .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}

// Daily pipeline entry point. Runs once per invocation (Render cron job).
// Wires the numbered steps together. Each step is currently a stub — see
// the individual files in this folder.
import "dotenv/config";
import { selectArticle } from "./1-select-article.js";
import { classifyArticle } from "./2-classify.js";
import { getPhoto } from "./3-get-photo.js";
import { getGeniusContent } from "./4-get-diss-content.js";
import { renderSlides } from "./5-render-slides.js";
import { buildCaption } from "./6-build-caption.js";
import { publishCarousel } from "./7-publish.js";
import { logAndReport } from "./8-log-and-report.js";

export async function runDailyFlow() {
  const item = await selectArticle();
  const classified = await classifyArticle(item);
  const photo = await getPhoto(item);
  const genius = classified.type === "diss" ? await getGeniusContent(item, classified.type) : null;
  const slides = await renderSlides({ item, classified, photo, genius });
  const caption = buildCaption({ item, classified, genius });
  const result = await publishCarousel({ slides, caption });
  return logAndReport({ item, classified, result });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyFlow()
    .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}

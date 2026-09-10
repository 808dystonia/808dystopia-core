import "dotenv/config";
import { selectArticle } from "./1-select-article.js";
import { classifyArticle } from "./2-classify.js";
import { getPhoto } from "./3-get-photo.js";
import { getGeniusContent } from "./4-get-diss-content.js";
import { renderSlides } from "./5-render-slides.js";
import { buildCaption } from "./6-build-caption.js";
import { hostImage, publishCarousel } from "./7-publish.js";
import { logAndReport } from "./8-log-and-report.js";
import { config } from "../config.js";

export async function runDailyFlow() {
  const { item, slug } = await selectArticle();
  if (!item) return logAndReport({ status: "skip", note: "No unused Morning Heat article. Carousel skipped." });
  const classified = await classifyArticle(item);
  const photo = await getPhoto(item);
  if (!photo.ok) return logAndReport({ item, slug, type: classified.type, status: "skip", note: "No real photo from Pinterest or Google. Switched article rule: skip." });
  const genius = await getGeniusContent(item, classified.type).catch((err) => {
    console.log("genius:", err.message);
    return { ok: false, verified: false, tracks: [], quote: "", source: "", confidence: 0 };
  });
  if (classified.type === "diss" && genius.confidence < 0.5) {
    classified.type = "other";
    classified.reason = "diss confidence too low, context slide";
  }
  const slides = await renderSlides({ item, type: classified.type, hook: classified.hook, photoUrl: photo.url, genius });
  const copy = buildCaption({ item, type: classified.type, genius });
  const u1 = await hostImage(slides.slide1);
  const u2 = await hostImage(slides.slide2);
  const pub = await publishCarousel({ urls: [u1, u2], caption: copy.caption, comments: copy.comments });
  return logAndReport({ item, slug, type: classified.type, mediaId: pub.mediaId, status: pub.published ? "published" : "staged", note: `${classified.type} photo=${photo.source} slide2=${slides.slide2Kind} publish=${config.publish ? "ON" : "OFF"} ${u1} ${u2}` });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyFlow()
    .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); logAndReport({ status: "error", note: err.message }).finally(() => process.exit(1)); });
}

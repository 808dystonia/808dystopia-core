// News carousel selection and IG/FB publishing with durable publication receipts.
import "dotenv/config";
import { getCandidates } from "./1-select-article.js";
import { classifyArticle } from "./2-classify.js";
import { getPhoto } from "./3-get-photo.js";
import { getGeniusContent } from "./4-get-diss-content.js";
import { renderSlides } from "./5-render-slides.js";
import { buildCaption } from "./6-build-caption.js";
import { publishCarousel } from "./7-publish.js";
import { logAndReport } from "./8-log-and-report.js";
import { crosspostToFacebook } from "./9-crosspost-facebook.js";
import { readLogRows, isAlreadyPosted } from "../clients/googleSheets.js";
import { config } from "../config.js";
import { contentKey, claimedPosts, bestEffort } from "../ops/publishing.js";
import { finishPost } from "../ops/followups.js";
import { postComment } from "../clients/instagram.js";
import { isSensitiveClaim } from "../util/sensitiveContent.js";

// Walks candidates newest-first: classify, skip repeats of already-posted
// stories (artist+title match against the Sheet log), skip anything with no
// usable photo from Pinterest (getPhoto).
// A candidate only "wins" once it clears both checks.
export async function selectPublishableArticle() {
  const [candidates, logRows] = await Promise.all([getCandidates(), readLogRows()]);

  const claims = config.publish ? await claimedPosts("carousel") : {};
  // Include durable receipts/uncertain claims in semantic and sensitive
  // dedup even when their Sheets mirror was never written.
  const dedupRows = [...logRows, ...Object.values(claims).map(post => ({
    artist: post.artist, title: post.title, status: 'posted', timestamp: post.publishedAt || post.startedAt,
  }))];
  for (const candidate of candidates) {
    if (claims[contentKey(candidate.text)]) continue;
    const classified = await classifyArticle(candidate);
    const sensitive = isSensitiveClaim(candidate.text) || isSensitiveClaim(classified.context);
    if (
      isAlreadyPosted(dedupRows, {
        artist: classified.artist,
        title: classified.title,
        sourceText: candidate.text,
        sensitive,
      })
    )
      continue;

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
    const result = await publishCarousel({ slides, caption, identity: candidate.text,
      metadata: { artist: classified.artist, title: classified.title, topic: classified.type, format: 'carousel' } });
    return await finishPost({ pipeline: 'carousel', result,
      comment: () => postComment(result.mediaId, caption.hashtags),
      log: () => logAndReport({ candidate, classified, status: result.published ? 'posted' : 'skipped', note: result.note }),
      facebook: () => crosspostToFacebook({ imageUrls: [result.slide1Url, result.slide2Url], message: caption.caption }),
    });
  } catch (err) {
    await bestEffort(() => logAndReport({ candidate, classified, status: 'failed', note: 'Publishing interrupted; inspect operational state before retrying.' }));
    throw err;
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.js");
if (invokedDirectly) {
  runDailyFlow()
    .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}

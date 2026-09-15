// Computes the data payload for the 808 Ops dashboard (a published Claude
// Artifact, not part of the posting pipelines themselves) from the same
// Sheet logs the pipelines already write to. Prints one JSON object to
// stdout: { pipelines: {carousel, reel, pin}, weekly, posts }. A Routine
// re-runs this hourly and pushes the result into the artifact's db via
// ArtifactData -- see the dashboard's own doc comment for the collection
// shapes it expects.
//
// Deliberately excludes the four "signal" pipelines (News Brief, EOD
// Brief, Morning Sync, Trending Tuesday) -- they don't log outcomes to a
// Sheet, so their dashboard status comes from the latest GitHub Actions
// run's conclusion instead, fetched separately at refresh time.
import "dotenv/config";
import { readLogRows, readReelLogRows, readPinLogRows } from "../src/clients/googleSheets.js";

const CAROUSEL_TARGET = 2;
const REEL_TARGET = 2;
const PIN_TARGET = 3;

// Sheets reformats the timestamp logAndReport writes ("YYYY-MM-DD HH:MM:SS",
// CT wall clock) on read-back: space separator, unpadded hour. Pad it so
// Date.parse accepts it; treated as UTC here, which is fine for day-bucket
// and "most recent" comparisons -- nothing here needs exact-offset precision.
function parseCarouselTs(ts) {
  const m = (ts || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:${s}-05:00`;
  return { iso, ctDate: `${y}-${mo}-${d}`, ms: Date.parse(iso) };
}

function parseUtcTs(ts) {
  const ms = Date.parse(ts);
  if (isNaN(ms)) return null;
  const ctDate = new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return { iso: new Date(ms).toISOString(), ctDate, ms };
}

function ctDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function summarize(rows, parseFn) {
  return rows.map((r) => ({ ...r, _t: parseFn(r.timestamp) })).filter((r) => r._t);
}

function pipelineSummary(parsed, target, artistField, titleFn) {
  const today = ctDaysAgo(0);
  const todayCount = parsed.filter((r) => r._t.ctDate === today && r.status === "posted").length;
  const last = parsed[parsed.length - 1];
  return {
    todayCount,
    todayTarget: target,
    lastStatus: last?.status || null,
    lastArtist: last?.[artistField] || null,
    lastTitle: last ? titleFn(last) : null,
    lastAtIso: last?._t.iso || null,
  };
}

const reelTitle = (r) => (r.videoId ? `youtu.be/${r.videoId}` : null);

function weeklySeries(parsed) {
  const dates = Array.from({ length: 7 }, (_, i) => ctDaysAgo(6 - i));
  return dates.map((d) => parsed.filter((r) => r._t.ctDate === d && r.status === "posted").length);
}

const news = summarize(await readLogRows(), parseCarouselTs);
const reels = summarize(await readReelLogRows(), parseCarouselTs);
const pins = summarize(await readPinLogRows(), parseUtcTs);

const dates = Array.from({ length: 7 }, (_, i) => ctDaysAgo(6 - i));

const merged = [
  ...news.filter((r) => r.status === "posted").map((r) => ({ pipeline: "carousel", platform: "IG + FB", artist: r.artist, title: r.title, status: r.status, atIso: r._t.iso })),
  ...reels.filter((r) => r.status === "posted").map((r) => ({ pipeline: "reel", platform: "IG + FB", artist: r.artist, title: reelTitle(r), status: r.status, atIso: r._t.iso })),
  ...pins.filter((r) => r.status === "posted").map((r) => ({ pipeline: "pin", platform: "Pinterest", artist: r.artist, title: r.album, status: r.status, atIso: r._t.iso })),
]
  .sort((a, b) => Date.parse(b.atIso) - Date.parse(a.atIso))
  .slice(0, 20);

const payload = {
  pipelines: {
    carousel: pipelineSummary(news, CAROUSEL_TARGET, "artist", (r) => r.title),
    reel: pipelineSummary(reels, REEL_TARGET, "artist", reelTitle),
    pin: pipelineSummary(pins, PIN_TARGET, "artist", (r) => r.album),
  },
  weekly: {
    dates,
    carousel: weeklySeries(news),
    reel: weeklySeries(reels),
    pin: weeklySeries(pins),
  },
  posts: merged,
};

console.log(JSON.stringify(payload, null, 2));

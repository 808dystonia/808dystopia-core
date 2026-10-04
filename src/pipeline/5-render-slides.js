// Step 5: render the carousel slides (HTML/CSS -> PNG via Puppeteer) using
// the templates in src/templates/. Slide 1 is always the cover (with an
// optional album-art inset for album_drop). Slide 2 depends on
// classification: tracklist (album_drop), lyric quote (diss/cosign/
// shoutout/callout with a confident Genius match), or general context
// (everything else, including a diss that Genius couldn't confidently
// match — that's a fallback to context, not a failure). The final slide
// is the pre-made closer video, reused as-is (not rendered here).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const CANVAS = { width: 1080, height: 1350 };

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}

// Downloads a remote image to a local file and returns a file:// URL.
// Puppeteer's Chromium has its own network stack, separate from Node's
// fetch — rather than depend on it being able to reach arbitrary external
// hosts (proxy config, hotlink protection, CDN hiccups mid-render) at
// screenshot time, images are fetched once up front through the same fetch
// path the rest of the pipeline already uses.
async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return `file://${destPath}`;
}

function escapeHtml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Wraps the accent substring (if it's actually present) in a red span;
// otherwise just returns the escaped plain text.
function withAccent(text, accent) {
  const safe = escapeHtml(text);
  if (!accent) return safe;
  const idx = text.indexOf(accent);
  if (idx === -1) return safe;
  const before = escapeHtml(text.slice(0, idx));
  const mid = escapeHtml(accent);
  const after = escapeHtml(text.slice(idx + accent.length));
  return `${before}<span class="accent">${mid}</span>${after}`;
}

// Picks a tier from a list of {maxLength, ...} tiers (ascending) by a
// length count, scaling down as that count grows instead of letting
// content overflow its fixed-size box. Falls back to the smallest tier
// for anything longer. `length` can be text length or an item count.
function pickTier(length, tiers) {
  const tier = tiers.find((t) => length <= t.maxLength);
  return tier || tiers[tiers.length - 1];
}

function pickFontSize(text, tiers) {
  return pickTier((text || "").length, tiers).size;
}

const QUOTE_FONT_TIERS = [
  { maxLength: 70, size: 56 },
  { maxLength: 110, size: 48 },
  { maxLength: 160, size: 40 },
  { maxLength: Infinity, size: 34 },
];

const EXPLANATION_FONT_TIERS = [
  { maxLength: 300, size: 32 },
  { maxLength: 450, size: 28 },
  { maxLength: 600, size: 24 },
  { maxLength: Infinity, size: 21 },
];


// Most titles are a few words and comfortable at the original 140px. A
// title with no spaces at all (e.g. a filename-style "FREE_METHODS.zip")
// has nothing to wrap on, so it also gets `overflow-wrap: anywhere` in
// the template as a backstop — the tier keeps that backstop from ever
// being needed in the common case.
const TITLE_FONT_TIERS = [
  { maxLength: 14, size: 140 },
  { maxLength: 20, size: 100 },
  { maxLength: 28, size: 76 },
  { maxLength: Infinity, size: 58 },
];

// Tracklist layout: one column up to this many rows, two above it. The
// font size is not picked here -- the template measures the rendered rows
// in the browser and shrinks the font until every title fits in full and
// the list fills the space (fixed size tiers left titles cut off with
// "..." and a big empty band under short lists). MAX_TOTAL_ROWS is the
// hard cap across both columns; beyond it the list ends with "+N MORE".
const SINGLE_COLUMN_MAX_ROWS = 12;
const MAX_TOTAL_ROWS = 36;

// No reliable linguistic rule exists for which part of an arbitrary
// release title to highlight — matches the approved reference (NOT DA 2
// -> "NOT" plain, "DA 2" accent) by accenting the last word (or last two,
// for titles of 3+ words).
function splitTitleAccent(title) {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return escapeHtml(title);
  const accentCount = words.length >= 3 ? 2 : 1;
  const plain = words.slice(0, -accentCount).join(" ");
  const accent = words.slice(-accentCount).join(" ");
  return `${escapeHtml(plain)} <span class="accent">${escapeHtml(accent)}</span>`;
}

function buildCoverHtml({ classified, photoUrl, albumArtLocalUrl }) {
  let line1;
  let line2Html;
  let albumCoverBlock = "";

  if (classified.type === "album_drop") {
    line1 = classified.artist;
    line2Html = `DROPS <span class="accent">&ldquo;${escapeHtml(classified.title)}&rdquo;</span>`;
    if (albumArtLocalUrl) {
      albumCoverBlock = `<img class="album-inset" src="${albumArtLocalUrl}" />`;
    }
  } else {
    line1 = classified.headlineLine1 || classified.artist;
    line2Html = withAccent(classified.headlineLine2, classified.headlineAccent);
  }

  return readTemplate("cover.html")
    .replace("{{PHOTO_URL}}", photoUrl)
    .replace("{{ALBUM_COVER_BLOCK}}", albumCoverBlock)
    .replace("{{LINE1}}", escapeHtml(line1))
    .replace("{{LINE2_HTML}}", line2Html);
}

// Spotify writes feature credits several ways: "Song - feat. X",
// "Song (feat. X)", "Song [feat. X]", "Song (with X)". The credit is
// split off and shown small after the title, so it's the part that gives
// way when space is tight, never the title.
const FEATURE = /^(.*?)\s*(?:[-–—]\s*|[([]\s*)(?:feat\.?|ft\.?|featuring|with)\s+([^)\]]+?)\s*[)\]]?\s*$/i;

export function splitFeature(name) {
  const match = String(name || "").match(FEATURE);
  if (!match || !match[1].trim()) return { title: String(name || "").trim(), feat: "" };
  return { title: match[1].trim(), feat: match[2].trim() };
}

function buildTrackRow(name, index) {
  const num = String(index + 1).padStart(2, "0");
  const { title, feat } = splitFeature(name);
  return `<div class="track-row"><span class="num">${num}</span><span class="name">${escapeHtml(title)}</span>${
    feat ? `<span class="feat">ft. ${escapeHtml(feat)}</span>` : ""
  }</div>`;
}

function buildSummaryRow(text) {
  return `<div class="track-row"><span class="num"></span><span class="name">${escapeHtml(text)}</span></div>`;
}

function buildTracklistColumn(rowsHtml) {
  return `<div class="tracklist-col">${rowsHtml}</div>`;
}

function buildTracklistHtml({ classified }) {
  const { tracklist, title } = classified;

  // A list within the cap shows every track; one over it truncates to
  // make room for the "+N MORE" row rather than showing N-1 tracks plus
  // a row saying "+1 more" for a single track.
  const overflowCount = tracklist.length - MAX_TOTAL_ROWS;
  const shown = overflowCount > 0 ? tracklist.slice(0, MAX_TOTAL_ROWS - 1) : tracklist;
  const summaryText = overflowCount > 0 ? `+ ${tracklist.length - shown.length} MORE` : null;
  const totalRows = shown.length + (summaryText ? 1 : 0);

  let bodyHtml;
  if (totalRows <= SINGLE_COLUMN_MAX_ROWS) {
    const rows = shown.map((name, i) => buildTrackRow(name, i));
    if (summaryText) rows.push(buildSummaryRow(summaryText));
    bodyHtml = `<div class="tracklist-cols">${buildTracklistColumn(rows.join("\n"))}</div>`;
  } else {
    // Numbering continues across the split (left holds 1..k, right
    // continues k+1..n), the way a person reads a two-column list.
    const leftCount = Math.ceil(totalRows / 2);
    const leftRows = shown.slice(0, leftCount).map((name, i) => buildTrackRow(name, i));
    const rightRows = shown.slice(leftCount).map((name, i) => buildTrackRow(name, leftCount + i));
    if (summaryText) rightRows.push(buildSummaryRow(summaryText));
    bodyHtml = `<div class="tracklist-cols">${buildTracklistColumn(leftRows.join("\n"))}${buildTracklistColumn(rightRows.join("\n"))}</div>`;
  }

  const count = tracklist.length;
  return readTemplate("slide-tracklist.html")
    .replace("{{TITLE_FONT_SIZE}}", pickFontSize(title, TITLE_FONT_TIERS))
    .replace("{{TITLE_HTML}}", splitTitleAccent(title))
    .replace("{{TRACK_COUNT}}", `${count} ${count === 1 ? "SONG" : "SONGS"}`)
    .replace("{{TRACKLIST_ROWS_HTML}}", bodyHtml);
}

function buildDissHtml({ classified, genius }) {
  return readTemplate("slide-diss.html")
    .replace("{{LYRIC_TAG}}", classified.lyricTag)
    .replace("{{TITLE}}", escapeHtml(classified.title))
    .replace("{{QUOTE_FONT_SIZE}}", pickFontSize(genius.quote, QUOTE_FONT_TIERS))
    .replace("{{QUOTE}}", escapeHtml(genius.quote))
    .replace("{{EXPLANATION_FONT_SIZE}}", pickFontSize(genius.explanation, EXPLANATION_FONT_TIERS))
    .replace("{{EXPLANATION}}", escapeHtml(genius.explanation));
}

// Grok's blurbs end with a source tag like "(HipHop Magz / SC)". It's
// pulled out into its own "SOURCE:" line instead of sitting mid-text.
export function splitSource(text) {
  const match = String(text || "").trim().match(/^(.*?)\s*\(([^()]{2,80})\)\s*\.?\s*$/s);
  if (!match || !match[1].trim()) return { body: String(text || "").trim(), source: "" };
  const body = match[1].trim().replace(/[\s,;:—-]+$/, "");
  return { body: /[.!?]$/.test(body) ? body : `${body}.`, source: match[2].trim() };
}

// The first sentence is the bold lead; the rest reads as lighter body.
export function splitLead(text) {
  const match = String(text || "").match(/^(.+?[.!?]["”’']?)(\s+[\s\S]+)?$/);
  if (!match || !match[2]) return { lead: String(text || "").trim(), rest: "" };
  return { lead: match[1].trim(), rest: match[2].trim() };
}

function buildContextHtml({ candidate, classified, photoUrl = "" }) {
  // Same red accent as the cover's second line.
  // Album drops carry no AI headline line 2; give them the cover's.
  const line2 = classified.headlineLine2 || (classified.title ? `DROPS "${classified.title}"` : "");
  const accent = classified.headlineLine2 ? classified.headlineAccent : classified.title ? `"${classified.title}"` : "";
  const titleHtml = [escapeHtml(classified.headlineLine1 || classified.artist), withAccent(line2, accent)]
    .filter(Boolean)
    .join(" ");
  const { body, source } = splitSource(classified.context || candidate.text);
  const { lead, rest } = splitLead(body);
  return readTemplate("slide-context.html")
    .replace("{{PHOTO_URL}}", photoUrl)
    .replace("{{TITLE}}", titleHtml)
    .replace("{{LEAD}}", escapeHtml(lead))
    .replace("{{REST}}", escapeHtml(rest))
    .replace("{{SOURCE}}", source ? `SOURCE: ${escapeHtml(source)}` : "");
}

// album_drop -> tracklist, but only when one was actually found (source
// text or Spotify) — an unreleased/unlisted album falls back to context
// rather than rendering an empty tracklist. diss/cosign/shoutout/callout
// -> lyric quote, but only with a confident Genius match; otherwise
// (including "other") falls back to the general context slide too.
// A tracklist slide with only a few songs looks empty, so short releases
// (singles, 2-4 track EPs) get the info slide instead.
export const MIN_TRACKLIST_SLIDE = 5;

function buildSlide2({ candidate, classified, genius, photoUrl }) {
  if (classified.type === "album_drop" && classified.tracklist.length >= MIN_TRACKLIST_SLIDE) {
    return { kind: "tracklist", html: buildTracklistHtml({ classified }) };
  }
  if (classified.type === "diss" && genius?.confident) {
    return { kind: "diss", html: buildDissHtml({ classified, genius }) };
  }
  return { kind: "context", html: buildContextHtml({ candidate, classified, photoUrl }) };
}

// Templates reference assets via relative paths ("assets/logo.png",
// "assets/Capture_it.ttf"), so the populated HTML has to live alongside
// them in src/templates/ for those to resolve — hence a temp file there
// rather than in the OS tmpdir.
async function renderHtmlToPng(page, html, outPath) {
  const tmpPath = path.join(TEMPLATES_DIR, `_render-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpPath, html);
  try {
    await page.goto(`file://${tmpPath}`, { waitUntil: "networkidle0" });
    // Templates that size text in the browser (slide-tracklist.html) set
    // window.__layoutDone = false and flip it once fitted; others never
    // set it, so this returns immediately for them.
    await page.waitForFunction(() => window.__layoutDone !== false, { timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: outPath });
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

export { buildTracklistHtml, buildContextHtml, buildSlide2 };

export async function renderSlides({ candidate, classified, photo, genius }) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "808-slides-"));

  const photoLocalUrl = await downloadToFile(photo.url, path.join(outDir, "photo.jpg"));
  let albumArtLocalUrl = null;
  if (classified.albumArtUrl) {
    try {
      albumArtLocalUrl = await downloadToFile(classified.albumArtUrl, path.join(outDir, "album-art.jpg"));
    } catch (err) {
      console.log("album art download:", err.message);
    }
  }

  const slide1Html = buildCoverHtml({ classified, photoUrl: photoLocalUrl, albumArtLocalUrl });
  const slide2 = buildSlide2({ candidate, classified, genius, photoUrl: photoLocalUrl });

  const slide1Path = path.join(outDir, "slide1.png");
  const slide2Path = path.join(outDir, "slide2.png");

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(CANVAS);
    await renderHtmlToPng(page, slide1Html, slide1Path);
    await renderHtmlToPng(page, slide2.html, slide2Path);
  } finally {
    await browser.close();
  }

  return {
    slide1Path,
    slide2Path,
    slide2Kind: slide2.kind,
    closerPath: path.join(TEMPLATES_DIR, "assets", "closer.mp4"),
  };
}

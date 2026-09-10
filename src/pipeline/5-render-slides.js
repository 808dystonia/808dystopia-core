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

// Picks a font size from a list of {maxLength, size} tiers (ascending),
// scaling text down as it gets longer instead of letting it overflow its
// fixed-height box. Falls back to the smallest tier for anything longer.
function pickFontSize(text, tiers) {
  const length = (text || "").length;
  const tier = tiers.find((t) => length <= t.maxLength);
  return (tier || tiers[tiers.length - 1]).size;
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

const CONTEXT_FONT_TIERS = [
  { maxLength: 200, size: 36 },
  { maxLength: 350, size: 32 },
  { maxLength: 500, size: 28 },
  { maxLength: Infinity, size: 24 },
];

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

// A track name like "PATCHED IT UP (FEAT. LIL YACHTY)" gets its feature
// credit pulled into its own smaller span; plain names pass through as-is.
function buildTrackRow(name, index) {
  const num = String(index + 1).padStart(2, "0");
  const match = name.match(/^(.*?)\s*(\((?:feat\.?|ft\.?|with)\s*[^)]+\))\s*$/i);
  const trackName = match ? match[1].trim() : name;
  const feat = match ? match[2].trim().toUpperCase() : "";
  return `<div class="track-row"><span class="num">${num}</span><span class="name">${escapeHtml(trackName)}</span>${
    feat ? `<span class="feat">${escapeHtml(feat)}</span>` : ""
  }</div>`;
}

function buildTracklistHtml({ classified }) {
  const rowsHtml = classified.tracklist.map(buildTrackRow).join("\n");
  return readTemplate("slide-tracklist.html")
    .replace("{{TITLE_HTML}}", splitTitleAccent(classified.title))
    .replace("{{TRACKLIST_ROWS_HTML}}", rowsHtml);
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

function buildContextHtml({ candidate, classified }) {
  const title = [classified.headlineLine1, classified.headlineLine2].filter(Boolean).join(" ");
  const context = classified.context || candidate.text;
  return readTemplate("slide-context.html")
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{CONTEXT_FONT_SIZE}}", pickFontSize(context, CONTEXT_FONT_TIERS))
    .replace("{{CONTEXT}}", escapeHtml(context));
}

// album_drop -> tracklist. diss/cosign/shoutout/callout -> lyric quote,
// but only with a confident Genius match; otherwise (including "other")
// falls back to the general context slide rather than failing.
function buildSlide2({ candidate, classified, genius }) {
  if (classified.type === "album_drop") {
    return { kind: "tracklist", html: buildTracklistHtml({ classified }) };
  }
  if (classified.type === "diss" && genius?.confident) {
    return { kind: "diss", html: buildDissHtml({ classified, genius }) };
  }
  return { kind: "context", html: buildContextHtml({ candidate, classified }) };
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
    await page.screenshot({ path: outPath });
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

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
  const slide2 = buildSlide2({ candidate, classified, genius });

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

// Step 2: composite the candidate's photo into the PS1/PS2-style
// game-case template (src/templates/boxart.html) via Puppeteer, same
// HTML-to-PNG approach the news carousel's renderer uses (see
// pipeline/5-render-slides.js) -- just one flat cover image here instead
// of a multi-slide carousel.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "boxart.html");
const CANVAS = { width: 1000, height: 1400 };

// Longer artist names shrink instead of overflowing the cover's ~774px-wide
// title box (870px cover minus 24px padding each side), same idea as the
// carousel's own TITLE_FONT_TIERS -- tuned against the "PINKPANTHERESS"
// (14 chars) test render, which nearly filled the box at 88px.
const TITLE_FONT_TIERS = [
  { maxLength: 8, size: 116 },
  { maxLength: 12, size: 96 },
  { maxLength: 16, size: 78 },
  { maxLength: 20, size: 62 },
  { maxLength: Infinity, size: 48 },
];

function pickTitleFontSize(name) {
  const tier = TITLE_FONT_TIERS.find((t) => name.length <= t.maxLength);
  return (tier || TITLE_FONT_TIERS[TITLE_FONT_TIERS.length - 1]).size;
}

// Fake catalog number, cosmetic only (matches the reference template's
// "SLUS-00888" corner detail) -- derived from the artist name so the same
// artist always gets the same number rather than a random one each run.
function catalogNumberFor(artist) {
  let hash = 0;
  for (const ch of artist) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return String(hash).padStart(5, "0");
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return `file://${destPath}`;
}

export async function renderCover({ artist, imageUrl }) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "808-boxart-"));
  const photoLocalUrl = await downloadToFile(imageUrl, path.join(outDir, "photo.jpg"));

  const html = fs
    .readFileSync(TEMPLATE_PATH, "utf8")
    .replace("{{PHOTO_URL}}", photoLocalUrl)
    .replace("{{ARTIST_NAME}}", artist.toUpperCase())
    .replace("{{TITLE_FONT_SIZE}}", String(pickTitleFontSize(artist)))
    .replace("{{CATALOG_NUMBER}}", catalogNumberFor(artist));

  const tmpHtmlPath = path.join(path.dirname(TEMPLATE_PATH), `_render-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpHtmlPath, html);

  const outPath = path.join(outDir, "cover.png");
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(CANVAS);
    await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: outPath });
  } finally {
    await browser.close();
    fs.unlinkSync(tmpHtmlPath);
  }

  return { coverPath: outPath };
}

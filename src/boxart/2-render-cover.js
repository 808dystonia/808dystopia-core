// Step 2: composite the candidate's photo into the PS1 jewel-case template
// (src/templates/boxart.html) via Puppeteer, same HTML-to-PNG approach the
// news carousel's renderer uses (see pipeline/5-render-slides.js).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const TEMPLATE_PATH = path.join(TEMPLATES_DIR, "boxart.html");
// Matches the reference cover the frame asset was cut from.
const CANVAS = { width: 1200, height: 1200 };

// Type size is fixed rather than stretched to fill, so every cover in the
// board's grid carries the same logotype weight — the reference's own
// "GLARE" only filled ~615px of the available width. Long names step down
// from there until they fit the space the frame leaves between the sidebar
// and the Sony lockup. Measured in the page after layout rather than
// tiered against guessed font metrics, so it holds for any name.
// 748px is the gap between the sidebar and the Sony lockup; the trailing
// "TM" sits outside the measured text, so it's budgeted out of that.
const TITLE_MAX_WIDTH = 690;
const TITLE_START_SIZE = 118;
const TITLE_MIN_SIZE = 30;

async function fitTitle(page) {
  return page.evaluate(
    (maxWidth, startSize, minSize) => {
      const stack = document.getElementById("title-stack");
      const spans = stack.querySelectorAll("span:not(.tm)");
      for (let size = startSize; size >= minSize; size -= 2) {
        spans.forEach((el) => {
          el.style.fontSize = `${size}px`;
        });
        // The face layer is the only in-flow one, so it drives the width.
        if (stack.querySelector(".face").getBoundingClientRect().width <= maxWidth) return size;
      }
      return minSize;
    },
    TITLE_MAX_WIDTH,
    TITLE_START_SIZE,
    TITLE_MIN_SIZE
  );
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
    .replaceAll("{{PHOTO_URL}}", photoLocalUrl)
    .replaceAll("{{ARTIST_NAME}}", artist.toUpperCase());

  // Written into the templates dir so the template's relative asset paths
  // ("assets/boxart-frame.png") resolve, same as the carousel's renderer.
  const tmpHtmlPath = path.join(TEMPLATES_DIR, `_render-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpHtmlPath, html);

  const outPath = path.join(outDir, "cover.png");
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(CANVAS);
    await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await fitTitle(page);
    await page.screenshot({ path: outPath });
  } finally {
    await browser.close();
    fs.unlinkSync(tmpHtmlPath);
  }

  return { coverPath: outPath };
}

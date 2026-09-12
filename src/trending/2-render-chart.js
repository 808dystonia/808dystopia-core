// Step 2: render the top-10 chart (src/templates/slide-trending.html ->
// PNG via Puppeteer), same technique as the carousel's
// pipeline/5-render-slides.js.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { chicagoDateString } from "../util/chicagoHour.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const CANVAS = { width: 1080, height: 1350 };

function escapeHtml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildRowHtml(entry, rank) {
  const num = String(rank).padStart(2, "0");
  return `<div class="row">
    <span class="rank">${num}</span>
    <span class="name">${escapeHtml(entry.name)}</span>
    <span class="streams">${escapeHtml(entry.streamsLabel)}</span>
    <span class="arrow">&#8599;</span>
  </div>`;
}

function buildSubtitle() {
  const [year, month] = chicagoDateString(new Date()).split("-");
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "long" });
  return `TOP 10 UNDERGROUND · ${monthName.toUpperCase()} ${year}`;
}

function buildChartHtml(rankings) {
  const rowsHtml = rankings.map((entry, i) => buildRowHtml(entry, i + 1)).join("\n");
  return fs
    .readFileSync(path.join(TEMPLATES_DIR, "slide-trending.html"), "utf8")
    .replace("{{SUBTITLE}}", buildSubtitle())
    .replace("{{ROWS_HTML}}", rowsHtml);
}

export async function renderChart(rankings) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "808-trending-"));
  const chartPath = path.join(outDir, "trending.png");

  const html = buildChartHtml(rankings);
  const tmpPath = path.join(TEMPLATES_DIR, `_render-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpPath, html);

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(CANVAS);
    await page.goto(`file://${tmpPath}`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: chartPath });
  } finally {
    await browser.close();
    fs.unlinkSync(tmpPath);
  }

  return { chartPath };
}

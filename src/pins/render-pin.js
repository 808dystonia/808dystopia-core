// Renders the vertical 2:3 branded pin (src/templates/pin.html -> JPEG via
// Puppeteer, same technique as the carousel slides) and returns it as
// base64 for Pinterest's image_base64 upload, so no media has to be
// committed to the repo. Callers fall back to pinning the raw image URL
// when this throws, so a render problem never costs a pin.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const CANVAS = { width: 1000, height: 1500 };

const TITLE_FONT_TIERS = [
  { maxLength: 12, size: 112 },
  { maxLength: 20, size: 88 },
  { maxLength: 32, size: 66 },
  { maxLength: Infinity, size: 50 },
];

function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildPinHtml({ photoUrl, kicker, title, subtitle }) {
  const size = TITLE_FONT_TIERS.find((tier) => String(title).length <= tier.maxLength).size;
  return fs
    .readFileSync(path.join(TEMPLATES_DIR, "pin.html"), "utf8")
    .replace("{{TITLE_SIZE}}", String(size))
    .replace("{{PHOTO_URL}}", escapeHtml(photoUrl))
    .replace("{{KICKER}}", escapeHtml(kicker))
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{SUBTITLE}}", escapeHtml(subtitle));
}

// The photo is downloaded through Node first (see pipeline/5-render-slides.js
// for why Chromium isn't left to fetch remote images itself).
export async function renderBrandedPin({ imageUrl, kicker, title, subtitle }) {
  const { default: puppeteer } = await import("puppeteer");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "808-pin-"));

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download ${imageUrl} failed: ${res.status}`);
  const photoPath = path.join(outDir, "photo");
  fs.writeFileSync(photoPath, Buffer.from(await res.arrayBuffer()));

  // Written next to the template so its relative assets/ paths resolve.
  const htmlPath = path.join(TEMPLATES_DIR, `_pin-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(htmlPath, buildPinHtml({ photoUrl: `file://${photoPath}`, kicker, title, subtitle }));

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(CANVAS);
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    const jpeg = await page.screenshot({ type: "jpeg", quality: 90 });
    return Buffer.from(jpeg).toString("base64");
  } finally {
    await browser.close();
    fs.unlinkSync(htmlPath);
  }
}

// Pins with the branded image when it renders, else the raw image URL.
export async function brandedImageOrUrl(design, render = renderBrandedPin) {
  try {
    return { imageBase64: await render(design), branded: true };
  } catch (err) {
    console.log("branded pin render failed, pinning the raw image:", err.message);
    return { imageUrl: design.imageUrl, branded: false };
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { config } from "../config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(here, "../templates");
const outDir = path.resolve(here, "../../tmp");
const fontPath = path.join(templatesDir, "assets", "Capture_it.ttf");

function esc(s) {
  return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function paintHook(hook) {
  return esc(hook).replace(/(DROPS|DROP|DISS|BEEF|OUT NOW|SURPRISE)/gi, '<span class="red">$1</span>');
}
function trackRows(tracks) {
  return tracks.slice(0, 18).map((t, i) => {
    const name = typeof t === "string" ? t : t.name;
    const feat = typeof t === "string" ? "" : t.feat;
    const featHtml = feat ? ` <span class="feat">(FEAT. ${esc(feat).toUpperCase()})</span>` : "";
    return `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="name">${esc(name).toUpperCase()}${featHtml}</span></li>`;
  }).join("");
}
async function loadTemplate(name) {
  return fs.readFile(path.join(templatesDir, name), "utf8");
}
async function fontFaceTag() {
  try {
    const buf = await fs.readFile(fontPath);
    const uri = `data:font/ttf;base64,${buf.toString("base64")}`;
    return `@font-face{font-family:'CaptureIt';src:url('${uri}') format('truetype');font-weight:normal;font-style:normal}`;
  } catch (err) {
    console.log("font missing at", fontPath, err.message);
    return "";
  }
}
async function renderHtml(html, dest) {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"], headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: config.canvas.w, height: config.canvas.h, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.screenshot({ path: dest, type: "jpeg", quality: 93 });
  } finally {
    await browser.close();
  }
  return dest;
}
export async function renderSlides({ item, type, hook, photoUrl, genius }) {
  const face = await fontFaceTag();
  const coverHtml = (await loadTemplate("cover.html")).replaceAll("{{FONT_FACE}}", face).replaceAll("{{ARTIST}}", esc(item.artist).toUpperCase()).replaceAll("{{HOOK}}", paintHook(hook.toUpperCase())).replaceAll("{{PHOTO_URL}}", esc(photoUrl));
  let slide2Name = "slide-context.html";
  if (type === "album" && genius.verified && genius.tracks.length >= 2) slide2Name = "slide-tracklist.html";
  if (type === "diss") slide2Name = "slide-diss.html";
  const slide2Html = (await loadTemplate(slide2Name)).replaceAll("{{FONT_FACE}}", face).replaceAll("{{TITLE}}", esc(item.title).toUpperCase()).replaceAll("{{TRACKLIST}}", trackRows(genius.tracks || [])).replaceAll("{{QUOTE}}", esc(genius.quote || item.line).toUpperCase()).replaceAll("{{CONTEXT}}", esc(item.line).toUpperCase()).replaceAll("{{SOURCE}}", esc(genius.source || "SOURCE: HEAT").toUpperCase());
  const s1 = path.join(outDir, "slide1.jpg");
  const s2 = path.join(outDir, "slide2.jpg");
  await renderHtml(coverHtml, s1);
  await renderHtml(slide2Html, s2);
  return { slide1: s1, slide2: s2, slide2Kind: slide2Name };
}

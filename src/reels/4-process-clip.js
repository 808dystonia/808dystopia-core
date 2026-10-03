// Step 4: download just the selected highlight's time range and render it
// into the 808 Reel template via ffmpeg (clients/ffmpeg.js formatForReel):
// the hook from step 5 as a headline, the clip in a blurred-background
// letterbox (not a hard crop -- see formatForReel for why), and the logo
// with @808DYSTOPIA below it. Uses the same placeholder logo.png the
// carousel pipeline already accepts as a stand-in for the official brand
// asset -- swap both at once whenever the real files are provided.
//
// Unlike step 3's temp audio (downloaded, transcribed, and discarded
// within one function call), this step's output file has to survive until
// step 6 actually publishes it -- so the temp dir here is deliberately
// NOT auto-cleaned on return. Each pipeline run gets a fresh GitHub
// Actions container anyway, so there's nothing to leak long-term; this
// matches the news pipeline's render step, which doesn't clean up its temp
// slide directory either (see pipeline/5-render-slides.js).
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadVideoSection } from "../clients/ytdlp.js";
import { formatForReel, wrapOverlay } from "../clients/ffmpeg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATERMARK_PATH = path.join(__dirname, "../templates/assets/logo.png");
const HEADLINE_FONT_PATH = path.join(__dirname, "../templates/assets/Capture_it.ttf");
const HANDLE_FONT_PATH = path.join(__dirname, "../templates/assets/Michroma.ttf");

// The bundled font has no emoji glyphs, so they're dropped from the
// on-screen text (they stay in the caption).
const EMOJI = /\p{Extended_Pictographic}(\u{FE0F}|\u{200D}\p{Extended_Pictographic})*|\u{FE0F}/gu;

// overlayText is the on-screen hook from step 5, drawn as the template's
// headline. If drawing text fails for any reason, the clip is rendered
// with just the logo rather than losing the Reel.
export async function processClip(video, overlayText = "", { format = formatForReel, download = downloadVideoSection } = {}) {
  const { url, highlight } = video;
  const dir = await mkdtemp(path.join(tmpdir(), "reel-clip-"));

  const rawClipPath = await download(url, highlight.startSeconds, highlight.endSeconds, dir);
  const finalClipPath = path.join(dir, "final.mp4");

  const lines = wrapOverlay(String(overlayText || "").replace(EMOJI, "").toUpperCase());
  const overlayLineFiles = [];
  for (const [i, line] of lines.entries()) {
    const file = path.join(dir, `overlay-${i}.txt`);
    await writeFile(file, line);
    overlayLineFiles.push(file);
  }

  try {
    await format(rawClipPath, WATERMARK_PATH, finalClipPath, {
      headlineLineFiles: overlayLineFiles,
      headlineFontPath: HEADLINE_FONT_PATH,
      handleFontPath: HANDLE_FONT_PATH,
    });
    return { ...video, clipPath: finalClipPath, overlay: lines.join(" ") };
  } catch (err) {
    console.log("reel text failed, rendering clip and logo only:", err.message.slice(0, 300));
  }
  await format(rawClipPath, WATERMARK_PATH, finalClipPath);
  return { ...video, clipPath: finalClipPath, overlay: "" };
}

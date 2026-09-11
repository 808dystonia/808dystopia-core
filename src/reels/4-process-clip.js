// Step 4: download just the selected highlight's time range, format it for
// 9:16 (blurred-background letterbox, not a hard crop -- see
// clients/ffmpeg.js for why), and overlay the 808dystopia watermark
// (top-left corner) via ffmpeg. Uses the same placeholder logo.png the
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
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadVideoSection } from "../clients/ytdlp.js";
import { formatForReel } from "../clients/ffmpeg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATERMARK_PATH = path.join(__dirname, "../templates/assets/logo.png");

export async function processClip(video) {
  const { videoId, highlight } = video;
  const dir = await mkdtemp(path.join(tmpdir(), "reel-clip-"));

  const rawClipPath = await downloadVideoSection(videoId, highlight.startSeconds, highlight.endSeconds, dir);
  const finalClipPath = path.join(dir, "final.mp4");
  await formatForReel(rawClipPath, WATERMARK_PATH, finalClipPath);

  return { ...video, clipPath: finalClipPath };
}

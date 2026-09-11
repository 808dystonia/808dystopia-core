// ffmpeg wrapper (spawned as a child process) -- formats a clip for 9:16
// Reel output and overlays the brand watermark, top-left. Relies on the
// system ffmpeg binary rather than a bundled static one: ubuntu-latest
// GitHub Actions runners ship ffmpeg preinstalled, and this project
// already leans on that for step 3 (yt-dlp's own audio extraction needs it
// too, with no extra install step) -- confirmed working there, so no
// separate ffmpeg provisioning is added here either.
import { spawn } from "node:child_process";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920; // 9:16, standard Reel resolution
const WATERMARK_WIDTH = 160;
const WATERMARK_MARGIN = 40;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

// A straight center-crop from typical 16:9 source footage down to 9:16
// only keeps about 30% of the original frame width -- confirmed live, it
// read as "hella zoomed in" and cut off most of the actual visual content
// (two people talking became one person's shoulder filling the frame).
// This instead uses the standard blurred-background letterbox technique:
// the full, un-cropped source is scaled to fit inside the 9:16 canvas and
// shown intact in the center, while a blurred/darkened, cropped-to-fill
// copy of the same footage fills the empty space above and below --
// nothing from the original frame is lost, and the letterboxing doesn't
// read as dead space since it's still moving footage from the same clip.
export async function formatForReel(inputPath, watermarkPath, outputPath) {
  const filter =
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},gblur=sigma=25,eq=brightness=-0.05[bg];` +
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[merged];` +
    `[1:v]scale=${WATERMARK_WIDTH}:-1[wm];` +
    `[merged][wm]overlay=${WATERMARK_MARGIN}:${WATERMARK_MARGIN}[outv]`;

  await run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-i",
    watermarkPath,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return outputPath;
}

// ffmpeg wrapper (spawned as a child process) -- crops a clip to 9:16 and
// overlays the brand watermark, top-left. Relies on the system ffmpeg
// binary rather than a bundled static one: ubuntu-latest GitHub Actions
// runners ship ffmpeg preinstalled, and this project already leans on that
// for step 3 (yt-dlp's own audio extraction needs it too, with no extra
// install step) -- confirmed working there, so no separate ffmpeg
// provisioning is added here either.
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

// Center-crops to 9:16 regardless of the source's own aspect ratio (crops
// width down on typical wide/landscape source footage, or height down on
// anything already narrower than 9:16), scales to the standard Reel
// resolution, then overlays the watermark in the top-left corner.
export async function cropAndWatermark(inputPath, watermarkPath, outputPath) {
  const filter =
    `[0:v]crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)',` +
    `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},setsar=1[bg];` +
    `[1:v]scale=${WATERMARK_WIDTH}:-1[wm];` +
    `[bg][wm]overlay=${WATERMARK_MARGIN}:${WATERMARK_MARGIN}[outv]`;

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

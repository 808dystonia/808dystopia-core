// ffmpeg wrapper (spawned as a child process) -- formats a clip into the
// 9:16 808 Reel template (headline, clip, brand mark; see formatForReel). Relies on the
// system ffmpeg binary rather than a bundled static one -- installed via
// apt in CI (see .github/workflows/daily-reel.yml). NOTE: ubuntu-latest
// does NOT actually ship ffmpeg preinstalled, despite this file previously
// assuming otherwise -- confirmed live when yt-dlp's own audio-extraction
// postprocessing failed with "ffprobe and ffmpeg not found" on a run that
// finally got far enough to need it.
import { spawn } from "node:child_process";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920; // 9:16, standard Reel resolution

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

// The 808 Reel template, top to bottom (Instagram's own UI covers roughly
// the top 220px and the bottom 400px, and its buttons the right ~150px):
//
//   - headline: the hook in Capture It (the carousel cover font), white
//     with a drop shadow, up to 3 lines ending just above the clip
//   - the clip, full and uncropped, centred
//   - brand mark: a small logo and "@808DYSTOPIA" just below the clip
//
// The clip uses the blurred-background letterbox: a straight centre-crop
// of 16:9 footage to 9:16 keeps only ~30% of the frame (two people talking
// became one person's shoulder), so the full frame is shown intact and a
// blurred, darkened copy fills the space around it. The logo used to sit
// top-left, where Instagram's status bar and "Reels" header cover it.
//
// Headline lines are passed as text files so quotes and colons need no
// escaping, with expansion=none so a "%" stays literal.
const HEADLINE_FONT_SIZE = 84;
const HEADLINE_LINE_HEIGHT = 96;
const HEADLINE_BOTTOM = 620; // just above a centred 16:9 clip (656-1264)
const BRAND_TOP = 1300;
const LOGO_HEIGHT = 96;
const HANDLE_FONT_SIZE = 30;

export function wrapOverlay(text, maxChars = 18, maxLines = 3) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,;:.!?-]+$/, "")}…`;
  return kept;
}

// Bottom-aligned: the last line always ends at HEADLINE_BOTTOM.
export function headlineFilters(lineFiles, fontPath) {
  const top = HEADLINE_BOTTOM - lineFiles.length * HEADLINE_LINE_HEIGHT;
  return lineFiles.map((file, i) =>
    `drawtext=fontfile='${fontPath}':textfile='${file}':expansion=none:fontsize=${HEADLINE_FONT_SIZE}:` +
    `fontcolor=white:shadowcolor=black@0.85:shadowx=4:shadowy=4:` +
    `x=(w-text_w)/2:y=${top + i * HEADLINE_LINE_HEIGHT}`
  );
}

function handleFilter(fontPath) {
  return (
    `drawtext=fontfile='${fontPath}':text='@808DYSTOPIA':fontsize=${HANDLE_FONT_SIZE}:` +
    `fontcolor=white:shadowcolor=black@0.85:shadowx=2:shadowy=2:` +
    `x=(w-text_w)/2:y=${BRAND_TOP + LOGO_HEIGHT + 14}`
  );
}

// Without fonts (the fallback render) only the clip and logo are drawn.
export async function formatForReel(inputPath, watermarkPath, outputPath, { headlineLineFiles = [], headlineFontPath, handleFontPath } = {}) {
  const text = [
    ...(headlineLineFiles.length && headlineFontPath ? headlineFilters(headlineLineFiles, headlineFontPath) : []),
    ...(handleFontPath ? [handleFilter(handleFontPath)] : []),
  ];
  const filter =
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},gblur=sigma=30,eq=brightness=-0.22:saturation=0.8[bg];` +
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[merged];` +
    `[1:v]scale=-1:${LOGO_HEIGHT}[wm];` +
    `[merged][wm]overlay=(W-w)/2:${BRAND_TOP}` +
    (text.length ? `,${text.join(",")}` : "") +
    `[outv]`;

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

// A 4:5 carousel slide made from a music-video clip (the "new video" slide
// of a video-drop carousel): the clip uncropped over a blurred, darkened
// copy of itself, "NOW PLAYING" above it, the song and artist below in the
// carousel's Capture It font, and the logo bottom-left like the other
// slides. Instagram carousel videos must be 3-60s; the clip is cut to
// maxSeconds regardless of what was downloaded.
const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;

export function carouselClipFilters({ kickerFile, titleLineFiles = [], kickerFontPath, titleFontPath }) {
  const kicker =
    `drawtext=fontfile='${kickerFontPath}':textfile='${kickerFile}':expansion=none:fontsize=44:` +
    `fontcolor=0xE01717:shadowcolor=black@0.85:shadowx=2:shadowy=2:x=(w-text_w)/2:y=250`;
  const titles = titleLineFiles.map(
    (file, i) =>
      `drawtext=fontfile='${titleFontPath}':textfile='${file}':expansion=none:fontsize=64:` +
      `fontcolor=white:shadowcolor=black@0.85:shadowx=3:shadowy=3:x=(w-text_w)/2:y=${1010 + i * 74}`
  );
  return [kicker, ...titles];
}

export async function formatForCarouselClip(inputPath, watermarkPath, outputPath, { maxSeconds = 20, ...text } = {}) {
  const drawn = text.kickerFile && text.kickerFontPath && text.titleFontPath ? carouselClipFilters(text) : [];
  const filter =
    `[0:v]scale=${SLIDE_WIDTH}:${SLIDE_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${SLIDE_WIDTH}:${SLIDE_HEIGHT},gblur=sigma=30,eq=brightness=-0.25:saturation=0.8[bg];` +
    `[0:v]scale=${SLIDE_WIDTH}:${SLIDE_HEIGHT}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[merged];` +
    `[1:v]scale=110:-1[wm];` +
    `[merged][wm]overlay=24:1190` +
    (drawn.length ? `,${drawn.join(",")}` : "") +
    `[outv]`;

  await run("ffmpeg", [
    "-y", "-i", inputPath, "-i", watermarkPath,
    "-filter_complex", filter,
    "-map", "[outv]", "-map", "0:a?",
    "-t", String(maxSeconds),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return outputPath;
}

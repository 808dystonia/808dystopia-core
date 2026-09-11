// Downloads audio from a YouTube video via yt-dlp (spawned as a child
// process), authenticated with cookies from a real, logged-in Google
// account.
//
// Validated live end-to-end (real download, real transcription, real
// DeepSeek highlight pick) after working through two separate blockers:
//   1. Every cookie-less approach fails -- the default client needs a JS
//      runtime yt-dlp couldn't find, adding one (--js-runtimes node) still
//      got HTTP 403, and the "tv" client demands an interactive OAuth
//      device-linking flow. YouTube bot-checks anonymous/datacenter-IP
//      requests, which is exactly what GitHub Actions runners are. Real
//      account cookies (see YOUTUBE_COOKIES in .env.example) fix this.
//   2. Cookies alone still aren't enough -- YouTube also throws a JS-based
//      "n challenge" at every request. yt-dlp needs both a JS runtime to
//      solve it AND the solver script distribution (the yt-dlp-ejs pip
//      package). Node was detected but reported "unsupported"; deno (yt-dlp's
//      own top-priority, best-supported runtime) worked immediately once
//      yt-dlp-ejs was installed alongside it -- no extra flag needed, deno
//      is picked automatically when present.
//
// Requires on PATH: the yt-dlp binary, the yt-dlp-ejs pip package, deno,
// and ffmpeg (used by yt-dlp itself for the audio extraction/format
// conversion) -- all installed in CI, see .github/workflows/daily-reel.yml.
import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "../config.js";

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
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

// Writes cookies to a temp file for the duration of a single yt-dlp call
// and always removes it afterward, success or failure -- narrows how long
// the plaintext cookie file sits on disk, which matters more for step 4's
// output dir than step 3's (that one's whole temp dir is wiped immediately
// after use, but step 4's has to survive until publishing, so its cookies
// file would otherwise linger for the rest of the run).
async function runYtDlpWithCookies(outputDir, args) {
  if (!config.youtube.cookies) throw new Error("YOUTUBE_COOKIES missing");

  const cookiesPath = path.join(outputDir, "cookies.txt");
  await writeFile(cookiesPath, config.youtube.cookies);
  try {
    await run("yt-dlp", ["--cookies", cookiesPath, ...args]);
  } finally {
    await unlink(cookiesPath).catch(() => {});
  }
}

// Downloads the best available audio track for a video, converts it to WAV
// (what the local Whisper transcription step needs), and returns the path.
// outputDir must already exist; the caller owns cleaning it up.
export async function downloadAudio(videoId, outputDir) {
  const outputTemplate = path.join(outputDir, "audio");
  await runYtDlpWithCookies(outputDir, [
    "-f",
    "bestaudio[ext=m4a]/bestaudio/best",
    "--extract-audio",
    "--audio-format",
    "wav",
    "--audio-quality",
    "0",
    "--no-playlist",
    "-o",
    outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);

  return `${outputTemplate}.wav`;
}

// Downloads only the highlight's time range (not the whole video) as an
// MP4 -- step 3 already downloaded this video once for audio-only
// transcription and discarded it, so step 4 deliberately doesn't re-fetch
// the full thing a second time. --download-sections does the range
// selection during download; --force-keyframes-at-cuts re-encodes around
// the cut points so it lands on the actual requested timestamps instead of
// snapping to the nearest keyframe (our highlight window comes from
// Whisper timestamps, not keyframe-aligned ones).
export async function downloadVideoSection(videoId, startSeconds, endSeconds, outputDir) {
  const outputTemplate = path.join(outputDir, "clip.%(ext)s");
  await runYtDlpWithCookies(outputDir, [
    "-f",
    "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--download-sections",
    `*${startSeconds}-${endSeconds}`,
    "--force-keyframes-at-cuts",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "-o",
    outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);

  return path.join(outputDir, "clip.mp4");
}

export async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

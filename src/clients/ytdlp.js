// Downloads audio from a YouTube video via yt-dlp (spawned as a child
// process), authenticated with cookies from a real, logged-in Google
// account.
//
// Validated live that every cookie-less approach fails: the default
// client needs a JS runtime yt-dlp couldn't find, adding one (--js-runtimes
// node) still got HTTP 403, and the "tv" client demands an interactive
// OAuth device-linking flow. All three point at the same thing -- YouTube
// now bot-checks anonymous/datacenter-IP requests, which is exactly what
// both this sandbox and GitHub Actions runners are. Real account cookies
// are the standard, reliable fix for this in practice. See YOUTUBE_COOKIES
// in .env.example for how to export them.
//
// Requires the yt-dlp binary on PATH (installed via pip in CI -- see
// .github/workflows/daily-reel.yml) and ffmpeg on PATH (used by yt-dlp
// itself for the audio extraction/format conversion).
import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
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

// Downloads the best available audio track for a video, converts it to WAV
// (what the local Whisper transcription step needs), and returns the path.
// outputDir must already exist; the caller owns cleaning it up.
export async function downloadAudio(videoId, outputDir) {
  if (!config.youtube.cookies) throw new Error("YOUTUBE_COOKIES missing");

  const cookiesPath = path.join(outputDir, "cookies.txt");
  await writeFile(cookiesPath, config.youtube.cookies);

  const outputTemplate = path.join(outputDir, "audio");
  await run("yt-dlp", [
    "--cookies",
    cookiesPath,
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

export async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-audio-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

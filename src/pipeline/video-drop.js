// Video-drop carousels. When a story is about a new music video ("Young
// M.A releases Therapy video"), the carousel gets a fourth slide: a 20s
// clip of that video, placed after the cover. Every step is best-effort:
// if the story isn't a video drop, the video can't be found, or the clip
// fails, the normal three-slide carousel posts instead.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchVideos, getVideoDetails } from "../clients/youtube.js";
import { downloadVideoSection } from "../clients/ytdlp.js";
import { formatForCarouselClip, wrapOverlay } from "../clients/ffmpeg.js";
import { mentionsArtist } from "../artist-pins/2-find-photo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../templates/assets");

// A release of a video, not any mention of one: "Video showed him
// bleeding" (10/03 LUCKI story) is footage, not a music video drop.
const VIDEO_WORDS =
  /\b(music video|official video|lyric video|visualizer|visuals? for)\b|\b(drops?|dropped|releases?|released|premieres?|premiered|shares?|shared|unveils?|unveiled|debuts?|debuted|revisits?)\b[^.]{0,60}\b(video|visuals?)\b|\b(video|visuals?) (for|to)\b/i;
export const CLIP_SECONDS = 20;
const MAX_VIDEO_AGE_DAYS = 30;

export function isVideoDrop({ candidate, classified }) {
  return [candidate?.text, classified?.headlineLine2, classified?.title, classified?.context].some((t) => VIDEO_WORDS.test(t || ""));
}

// "Therapy Video" -> "Therapy"; the classifier sometimes folds the word
// "video" into the title.
export function songTitle(title) {
  return String(title || "").replace(/["“”]/g, "").replace(/\s*\b(official\s+)?(music\s+)?(video|visuals?|visualizer)\b\s*/gi, " ").trim();
}

// The new video, not an old one with the same name: its title must name
// both the artist (or the channel must) and the song, and it must be
// public, a normal length, and recent.
export function pickVideo(details, artist, song, now = Date.now()) {
  return (
    details.find(
      (d) =>
        d.privacyStatus === "public" &&
        d.uploadStatus === "processed" &&
        d.liveBroadcastContent === "none" &&
        d.durationSeconds >= 45 &&
        d.durationSeconds <= 15 * 60 &&
        now - Date.parse(d.publishedAt) <= MAX_VIDEO_AGE_DAYS * 24 * 3600 * 1000 &&
        (mentionsArtist(artist, d.title, 3) || mentionsArtist(artist, d.channelTitle, 3)) &&
        mentionsArtist(song, d.title, 2)
    ) || null
  );
}

// About 30% in, where the first hook or chorus usually sits.
export function clipWindow(durationSeconds) {
  const start = Math.max(5, Math.min(Math.round(durationSeconds * 0.3), durationSeconds - CLIP_SECONDS - 1));
  return { startSeconds: start, endSeconds: start + CLIP_SECONDS };
}

export async function findDroppedVideo(artist, title) {
  const song = songTitle(title);
  if (!song) return null;
  const results = await searchVideos(`"${artist}" "${song}" video`, { maxResults: 8 });
  if (results.length === 0) return null;
  const details = await getVideoDetails(results.map((r) => r.videoId));
  return pickVideo(details, artist, song);
}

export async function buildVideoClipSlide({ candidate, classified }, deps = {}) {
  const { find = findDroppedVideo, download = downloadVideoSection, format = formatForCarouselClip } = deps;
  if (!isVideoDrop({ candidate, classified })) return null;
  try {
    const video = await find(classified.artist, classified.title);
    if (!video) {
      console.log(`video drop: no matching recent video for ${classified.artist} - ${classified.title}`);
      return null;
    }
    const dir = await mkdtemp(path.join(tmpdir(), "808-video-drop-"));
    const { startSeconds, endSeconds } = clipWindow(video.durationSeconds);
    const raw = await download(video.url, startSeconds, endSeconds, dir);

    const kickerFile = path.join(dir, "kicker.txt");
    await writeFile(kickerFile, "NOW PLAYING");
    // Capture It has no em dash, so "BY" joins song and artist.
    const lines = wrapOverlay(`"${songTitle(classified.title)}" by ${classified.artist}`.toUpperCase(), 24, 2);
    const titleLineFiles = [];
    for (const [i, line] of lines.entries()) {
      const file = path.join(dir, `title-${i}.txt`);
      await writeFile(file, line);
      titleLineFiles.push(file);
    }

    const clipPath = path.join(dir, "video-clip.mp4");
    await format(raw, path.join(ASSETS, "logo.png"), clipPath, {
      maxSeconds: CLIP_SECONDS,
      kickerFile,
      kickerFontPath: path.join(ASSETS, "Michroma.ttf"),
      titleLineFiles,
      titleFontPath: path.join(ASSETS, "Capture_it.ttf"),
    });
    return { clipPath, videoUrl: video.url, videoTitle: video.title, channelTitle: video.channelTitle };
  } catch (err) {
    console.log("video drop clip failed, posting without it:", err.message?.slice(0, 300));
    return null;
  }
}

// Step 3: download the candidate video's audio, transcribe it locally with
// Whisper (see clients/whisper.js -- no third-party YouTube transcript is
// reachable, see clients/youtube.js), then feed the timestamped transcript
// to the configured AI provider (clients/ai.js) to pick the best short window
// for a Reel highlight.
import { downloadAudio, withTempDir } from "../clients/ytdlp.js";
import { transcribeAudio, MAX_TRANSCRIBE_SECONDS } from "../clients/whisper.js";
import { generateJson } from "../clients/ai.js";

const MIN_CLIP_SECONDS = 15;
const MAX_CLIP_SECONDS = 90;

// Models often return a window a few seconds outside the allowed length
// (confirmed live 10/01: Gemini picked 11-12s clips, each one rejected,
// burning the run's time budget). A near-miss is stretched or trimmed
// around the chosen start instead, staying inside the video and the
// transcribed span; only an unusable answer (non-numbers, start past the
// end) is still rejected.
export function normalizeWindow(start, end, limitSeconds) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(limitSeconds)) return null;
  if (limitSeconds < MIN_CLIP_SECONDS || start < 0 || start >= limitSeconds) return null;
  let s = start;
  let e = Math.min(Math.max(end, s + MIN_CLIP_SECONDS), s + MAX_CLIP_SECONDS);
  if (e > limitSeconds) {
    e = limitSeconds;
    s = Math.min(s, e - MIN_CLIP_SECONDS);
  }
  return { startSeconds: s, endSeconds: e };
}

function formatTranscript(chunks) {
  return chunks
    .map(({ timestamp: [start, end], text }) => `[${start.toFixed(1)}-${end?.toFixed(1) ?? "?"}] ${text.trim()}`)
    .join("\n");
}

function buildPrompt(video, transcriptText) {
  return `You are picking a short highlight clip from a YouTube video of an underground hip-hop artist/producer, for a factual Instagram Reel. Read the timestamped transcript below and return ONLY a JSON object (no markdown, no other text) with these fields:

- startSeconds: number, the clip's start time
- endSeconds: number, the clip's end time (clip must be ${MIN_CLIP_SECONDS}-${MAX_CLIP_SECONDS} seconds long)
- quote: the single most striking thing the artist says within that window, verbatim from the transcript, one or two sentences (under 200 characters) that read well on their own as a caption
- reason: one sentence on why this moment is worth featuring (a strong bar, a notable technical/production insight, a genuinely interesting story beat, etc.)

Pick a genuinely compelling, self-contained moment -- not just the first thing said. Prefer moments that stand alone without needing earlier context. Do not invent content not present in the transcript.

Video: "${video.title}" by ${video.artist} (${video.contentType})

Timestamped transcript:
"""
${transcriptText}
"""

Return ONLY the JSON object.`;
}

export async function selectHighlight(video) {
  const transcript = await withTempDir(async (dir) => {
    const audioPath = await downloadAudio(video.url, dir);
    return transcribeAudio(audioPath);
  });

  const chunks = transcript.chunks || [];
  if (chunks.length === 0) throw new Error("empty transcript");

  const transcriptText = formatTranscript(chunks);
  const result = await generateJson(buildPrompt(video, transcriptText), "highlight");

  // The transcript only covers the opening minutes (see clients/whisper.js),
  // so the clip must too -- the quote has to be inside the clip.
  const limit = Math.min(video.durationSeconds, MAX_TRANSCRIBE_SECONDS);
  const window = normalizeWindow(Number(result.startSeconds), Number(result.endSeconds), limit);
  if (!window) throw new Error(`invalid highlight window: ${JSON.stringify(result)}`);
  const { startSeconds, endSeconds } = window;

  return {
    ...video,
    highlight: {
      startSeconds,
      endSeconds,
      quote: result.quote || "",
      reason: result.reason || "",
    },
  };
}

// Step 3: download the candidate video's audio, transcribe it locally with
// Whisper (see clients/whisper.js -- no third-party YouTube transcript is
// reachable, see clients/youtube.js), then feed the timestamped transcript
// to DeepSeek (swapped in for the spec's original "Gemini" -- same
// reasoning as the news pipeline's classifier: Gemini's free tier caps at
// 20 requests/day) to pick the best short window for a Reel highlight.
import { downloadAudio, withTempDir } from "../clients/ytdlp.js";
import { transcribeAudio } from "../clients/whisper.js";
import { classifyWithDeepSeek } from "../clients/deepseek.js";

const MIN_CLIP_SECONDS = 15;
const MAX_CLIP_SECONDS = 90;

function formatTranscript(chunks) {
  return chunks
    .map(({ timestamp: [start, end], text }) => `[${start.toFixed(1)}-${end?.toFixed(1) ?? "?"}] ${text.trim()}`)
    .join("\n");
}

function buildPrompt(video, transcriptText) {
  return `You are picking a short highlight clip from a YouTube video of an underground hip-hop artist/producer, for a factual Instagram Reel. Read the timestamped transcript below and return ONLY a JSON object (no markdown, no other text) with these fields:

- startSeconds: number, the clip's start time
- endSeconds: number, the clip's end time (clip must be ${MIN_CLIP_SECONDS}-${MAX_CLIP_SECONDS} seconds long)
- quote: the most important spoken line(s) within that window, verbatim from the transcript
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
    const audioPath = await downloadAudio(video.videoId, dir);
    return transcribeAudio(audioPath);
  });

  const chunks = transcript.chunks || [];
  if (chunks.length === 0) throw new Error("empty transcript");

  const transcriptText = formatTranscript(chunks);
  const result = await classifyWithDeepSeek(buildPrompt(video, transcriptText));

  const startSeconds = Number(result.startSeconds);
  const endSeconds = Number(result.endSeconds);
  const duration = endSeconds - startSeconds;
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    startSeconds < 0 ||
    endSeconds > video.durationSeconds ||
    duration < MIN_CLIP_SECONDS ||
    duration > MAX_CLIP_SECONDS
  ) {
    throw new Error(`invalid highlight window: ${JSON.stringify(result)}`);
  }

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

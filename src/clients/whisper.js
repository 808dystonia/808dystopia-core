// Local speech-to-text via transformers.js (ONNX Whisper running on CPU),
// used instead of any YouTube-hosted transcript -- see clients/youtube.js
// for why third-party captions are unreachable. Runs fully offline once the
// model weights are cached (first call downloads them from the Hugging
// Face Hub, a few hundred MB). Free -- no API cost, no daily cap.
//
// Uses whisper-base.en (English-only, the pipeline's content is always
// English-language hip-hop content) as the speed/accuracy tradeoff for a
// GitHub Actions CPU runner under a real time budget -- verified working
// mechanically end-to-end with whisper-tiny.en, including returned
// timestamps, but real-world transcription speed against a full-length
// video hasn't been measured yet (needs a real downloaded video, which
// needs YOUTUBE_COOKIES -- see 3-select-highlight.js).
import { readFile } from "node:fs/promises";

const MODEL = "Xenova/whisper-base.en";

let transcriberPromise = null;
function getTranscriber() {
  if (!transcriberPromise) {
    // Confirmed live (2026-09-16): a transient failure downloading the
    // model from the Hugging Face Hub (a few hundred MB, fetched fresh
    // every run since each GitHub Actions container starts clean) got
    // memoized as a permanently-rejected promise -- every candidate for
    // the rest of that run inherited the same cached rejection instead of
    // getting a fresh retry, turning one network blip into a whole-run
    // failure. Resetting the memo on rejection lets the next call retry.
    transcriberPromise = import("@huggingface/transformers")
      .then(({ pipeline }) => pipeline("automatic-speech-recognition", MODEL))
      .catch((err) => {
        transcriberPromise = null;
        throw err;
      });
  }
  return transcriberPromise;
}

async function loadAudioFloat32(wavPath) {
  const { default: wf } = await import("wavefile");
  const { WaveFile } = wf;
  const buf = await readFile(wavPath);
  const wav = new WaveFile(buf);
  wav.toBitDepth("32f");
  wav.toSampleRate(16000);
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) audioData = audioData[0];
  return audioData;
}

// CPU Whisper on a 20-minute video can eat most of the 30-minute Reel job
// on its own (confirmed live 10/01: two runs killed at the job timeout
// mid-transcription), so only the opening minutes are transcribed -- plenty
// to pick a 15-90s highlight from.
export const MAX_TRANSCRIBE_SECONDS = 8 * 60;
const SAMPLE_RATE = 16000;

// Returns { text, chunks: [{ timestamp: [startSeconds, endSeconds], text }] }.
export async function transcribeAudio(wavPath, maxSeconds = MAX_TRANSCRIBE_SECONDS) {
  const [transcriber, audioData] = await Promise.all([getTranscriber(), loadAudioFloat32(wavPath)]);
  const capped = audioData.length > maxSeconds * SAMPLE_RATE ? audioData.slice(0, maxSeconds * SAMPLE_RATE) : audioData;
  return transcriber(capped, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
}

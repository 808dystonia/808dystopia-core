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
    transcriberPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("automatic-speech-recognition", MODEL)
    );
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

// Returns { text, chunks: [{ timestamp: [startSeconds, endSeconds], text }] }.
export async function transcribeAudio(wavPath) {
  const [transcriber, audioData] = await Promise.all([getTranscriber(), loadAudioFloat32(wavPath)]);
  return transcriber(audioData, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
}

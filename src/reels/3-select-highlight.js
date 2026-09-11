// Step 3: feed the video's transcript to DeepSeek (swapped in for the
// spec's original "Gemini" — same reasoning as the news pipeline's
// classifier: Gemini's free tier caps at 20 requests/day, too thin once
// both pipelines are calling it) and have it pick the best timestamp
// range for a short highlight clip (Reel length, ~15-90 seconds).
// TODO: implement once step 2 delivers a real transcript to test
// against — the prompt design depends on the transcript's actual shape
// (plain text vs. timestamped segments).
export async function selectHighlight(_video) {
  throw new Error("not implemented: selectHighlight");
}

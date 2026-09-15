// AI image generation via Replicate (black-forest-labs/flux-schnell --
// fast, cheap, strong prompt adherence for stylized mashup art). Chosen
// over OpenAI's image models specifically because OpenAI's content policy
// is more likely to refuse or flatten prompts naming real public figures
// (exactly what RapToonz needs -- see raptoonz/2-generate-image.js),
// while Replicate/Stability-hosted open models don't carry that same
// named-person restriction.
import { config } from "../config.js";

const MODEL = "black-forest-labs/flux-schnell";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90 * 1000;

function firstUrl(output) {
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === "string") return output;
  return null;
}

export async function generateImage(prompt) {
  if (!config.replicate.apiToken) throw new Error("REPLICATE_API_TOKEN missing");

  const createRes = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.replicate.apiToken}`,
      "Content-Type": "application/json",
      // Has Replicate hold the response open for up to 60s -- flux-schnell
      // usually finishes well within that, avoiding a separate poll for
      // the common case. The loop below is the fallback for whatever
      // doesn't.
      Prefer: "wait=60",
    },
    body: JSON.stringify({ input: { prompt, aspect_ratio: "3:4", output_format: "png" } }),
  });
  let prediction = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(`Replicate prediction create failed: ${JSON.stringify(prediction)}`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
    if (Date.now() > deadline) throw new Error(`Replicate prediction ${prediction.id} timed out`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${config.replicate.apiToken}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.id} ${prediction.status}: ${prediction.error || "unknown error"}`);
  }

  const imageUrl = firstUrl(prediction.output);
  if (!imageUrl) throw new Error(`Replicate prediction ${prediction.id} succeeded but returned no output URL`);
  return imageUrl;
}

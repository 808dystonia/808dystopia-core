// DeepSeek (pay-as-you-go, OpenAI-compatible API) — classifies an article
// and extracts fields. Swapped in for Gemini: Gemini's free tier caps at
// 20 requests/day, which selectPublishableArticle can burn through in a
// single run walking candidates, with no headroom left for the day.
// DeepSeek has no such daily cap and is inexpensive per call.
import { config } from "../config.js";

const API = "https://api.deepseek.com/chat/completions";

export async function classifyWithDeepSeek(prompt) {
  const key = config.deepseek.apiKey;
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: config.deepseek.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`deepseek ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  const text = json?.choices?.[0]?.message?.content || "";
  return JSON.parse(text);
}
